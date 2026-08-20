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
  const sbx = await Sandbox.get({ name: "ports-1787254036891", token: VICTIM, teamId, projectId });
  // find name
  const { APIClient } = await import("/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js");
  const client = new APIClient({ token: VICTIM, teamId, projectId });
  const l: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbs = l.json?.sandboxes ?? l.json ?? [];
  const t = sbs.find((x: any) => x.name?.startsWith("ports-"));
  console.log("found:", t?.name);
  const s = await Sandbox.get({ name: t.name, token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "=== listeners actuales ==="
ss -tlnp 2>/dev/null | grep -E '3000|3000' || echo "(sin 3000)"
echo "=== ls del proyecto / arrancar next ==="
ls -la 2>/dev/null | head -5
cat package.json 2>/dev/null | grep -A3 scripts
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
