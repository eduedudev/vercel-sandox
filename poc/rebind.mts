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

  const script = `
set +e
echo "=== 1. MI dominio resuelto por distintos resolvers ==="
for res in 172.31.0.2 100.64.0.1 8.8.8.8 1.1.1.1; do
  echo "--- resolver $res ---"
  dig +short A ${mySub} @$res 2>/dev/null | head -5
  dig +short CNAME ${mySub} @$res 2>/dev/null | head -3
done
echo ""
echo "=== 2. zonas internas: probar sufijos con mi subdominio ==="
for suf in ".internal" ".ec2.internal" ".sandbox.internal" ".cell.internal" ".vercel.internal" ".svc.internal" ".run.internal" ".host.internal" ""; do
  for h in "${mySub%%.*}$suf" "sb-1cx1dcarx9qe$suf" "sb-1phoxyil6njl$suf"; do
    r=$(dig +short A $h @172.31.0.2 2>/dev/null | head -1)
    [[ -n "$r" ]] && echo "HIT $h -> $r"
  done
done
echo "--- PTR de mi IP de celda ---"
myip=$(ip -o addr | grep 'eth0' | grep -oE 'inet [0-9.]+' | awk '{print $2}')
echo "mi ip celda: $myip"
dig +short -x $myip @172.31.0.2 2>/dev/null
echo ""
echo "=== 3. DNS sobre la red de celdas: preguntar a 100.64.0.1 como DNS del propio pod ==="
dig +short A ${mySub} @100.64.0.1 +time=2 +tries=1 2>&1 | head -3
echo ""
echo "=== 4. consultar NS del TLD run y veracer run ==="
dig +short NS run. @172.31.0.2 2>/dev/null | head -3
dig +short NS vercel.run @172.31.0.2 2>/dev/null | head -3
echo ""
echo "=== 5. mi dominio via DNS publico normal ==="
getent hosts ${mySub}
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", script], { wait: true, timeout: 40_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });