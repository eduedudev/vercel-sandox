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
  const s = await Sandbox.get({ name: "ports2-1787254529828", token: VICTIM, teamId, projectId });
  const d3000 = s.domain(3000);
  console.log("domain(3000) =", d3000);
  // probar con el SDK fetchStream / waitForPort?
  console.log("=== waitForPort? no usamos. Pruebo con curl desde fuera ===");
  // ejecutar desde el sandbox un fetch hacia su propio dominio publico
  const r = await s.runCommand("bash", ["-c", `
set +e
echo "=== curl al propio dominio publico desde dentro ==="
timeout 10 curl -s -o /dev/null -w '%{http_code} %{size_download}B' --max-time 8 https://${d3000.replace('https://','')}/ 2>&1; echo ""
echo "=== DONE ==="
`], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
