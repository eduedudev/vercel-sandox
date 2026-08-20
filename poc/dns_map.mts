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
  const sbx = await Sandbox.create({
    name: "dns-map-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "===== DESDE DENTRO: vercel.com ====="
echo -n "172.31.0.2 vercel.com -> "; dig +short A vercel.com @172.31.0.2 | tr '\n' ' '; echo ""
echo -n "8.8.8.8 vercel.com -> "; dig +short A vercel.com @8.8.8.8 2>&1 | tr '\n' ' '; echo ""
echo -n "172.31.0.2 api.vercel.com -> "; dig +short A api.vercel.com @172.31.0.2 | tr '\n' ' '; echo ""
echo ""
echo "===== otros dominios de Vercel (desde dentro) ====="
for d in vercel.app vercel.run vercel-dns.com assets.vercel.com s3.amazonaws.com; do
  echo -n "  $d -> "; dig +short A $d @172.31.0.2 | tr '\n' ' '; echo ""
done
echo ""
echo "===== sondeo: cuantas IPs distintas del bloque 64.239 responden en 443? (muestreo /24s) ====="
for ip in 64.239.96.1 64.239.100.1 64.239.104.1 64.239.108.1 64.239.109.1 64.239.110.1 64.239.112.1 64.239.116.1 64.239.120.1 64.239.123.1 64.239.124.1 64.239.128.1; do
  if timeout 3 bash -c "timeout 2 bash -c 'echo > /dev/tcp/$ip/443' 2>/dev/null"; then echo "OPEN 443 $ip"; else echo "closed $ip"; fi
done
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 60_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });