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
echo "=== 1. gateways del gateway? ARP y ruta ==="
ip neigh
echo "--- rutas ---"
ip route
echo ""
echo "=== 2. quien es 100.64.0.1 (MAC del gateway) ==="
ip neigh | grep 100.64.0.1
echo ""
echo "=== 3. el gateway responde en otros puertos? ==="
for p in 22 80 443 3000 8080 23456 30001 30002 30003 5000 1; do
  timeout 2 bash -c "timeout 0.5 bash -c 'echo > /dev/tcp/100.64.0.1/$p' 2>/dev/null && echo GW OPEN $p" || true
done
echo ""
echo "=== 4. probar si el gateway hace PORT FORWARDING a la VM en otros puertos ==="
echo "--- conectar al gateway y pedir el 3000 de la VM (ya lo vimos: peer=100.64.0.1) ---"
echo "--- ahora probar si el gateway expone 30001/30002/30003/23456 (control plane) ---"
for p in 23456 30001 30002 30003; do
  timeout 2 bash -c "timeout 0.5 bash -c 'echo > /dev/tcp/100.64.0.1/$p' 2>/dev/null && echo GW OPEN $p" || true
done
echo ""
echo "=== 5. IP del gateway vista desde afuera? intentar conectar desde origen ==="
echo "(se hace desde el origen, no aqui)"
echo ""
echo "=== 6. traceroute hacia el gateway desde la VM ==="
traceroute -n -w 1 -q 1 -m 5 100.64.0.1 2>&1 | head -8
echo "=== DONE ==="
`;

async function main() {
  const client = new APIClient({ token: VICTIM, teamId, projectId });
  const l: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbxs = l.json?.sandboxes ?? l.json ?? [];
  const target = sbxs.find((s: any) => s.name?.startsWith("ingress-echo-"));
  if (!target) { console.error("no sandbox"); process.exit(1); }
  const s = await Sandbox.get({ name: target.name, token: VICTIM, teamId, projectId });
  const r = await s.runCommand("bash", ["-c", CMD], { wait: true, timeout: 60_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DOMAIN_3000=" + s.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });