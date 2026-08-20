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
  const s = await Sandbox.get({ name: "dns-probe-1787253418569", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "===== wildcard test: nombres absurdos vs nombres conocidos ====="
for sub in zzzz-nope-12345 qwxyz99 sb-4j0y9rk6yws9 vercel.com 64.239.109.65; do
  echo -n "  $sub.vercel.run -> "; dig +short A $sub.vercel.run @172.31.0.2 2>&1 | tr '\n' ' '; echo ""
done
echo ""
echo "===== registro TXT de vercel.run (SPF/DKIM/etc) ====="
dig +short TXT vercel.run @172.31.0.2 2>&1
echo "--- TXT de _dmarc / _acme ---"
dig +short TXT _dmarc.vercel.run @172.31.0.2 2>&1
echo "--- TXT de vercel.com ---"
dig +short TXT vercel.com @172.31.0.2 2>&1 | head -3
echo ""
echo "===== SRV records (servicios) ====="
for srv in _sip._tcp _xmpp-server._tcp _ldap._tcp _kerberos._tcp; do
  echo -n "  $srv.vercel.run -> "; dig +short SRV $srv.vercel.run @172.31.0.2 2>&1 | tr '\n' ' '; echo ""
done
echo ""
echo "===== resolver interno vs externo: misma respuesta? ====="
echo "--- via 172.31.0.2 ---"
dig +short A api.vercel.run @172.31.0.2
echo "--- via 1.1.1.1 (si llega) ---"
dig +short A api.vercel.run @1.1.1.1 2>&1 | head -2
echo ""
echo "===== hay algun dominio 'vercel.run' con NXDOMAIN? (para ver wildcard) ====="
dig A zzzz-nope-12345.vercel.run @172.31.0.2 2>&1 | grep -E 'status|NOERROR|NXDOMAIN'
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });