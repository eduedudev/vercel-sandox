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
  // el sandbox dns-probe puede haber expirado; crear uno nuevo si hace falta
  let s;
  try {
    s = await Sandbox.get({ name: "dns-probe-1787253418569", token: VICTIM, teamId, projectId });
  } catch { s = null; }
  if (!s) {
    s = await Sandbox.create({
      name: "dns-cmp-" + Date.now(),
      token: VICTIM, teamId, projectId,
      source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
      ports: [3000],
    });
  }
  const SCRIPT = `
set +e
DOM=sb-4j0y9rk6yws9.vercel.run
echo "=== DESDE DENTRO (resolver interno 172.31.0.2) ==="
echo -n "172.31.0.2 -> "; dig +short A $DOM @172.31.0.2 | tr '\n' ' '; echo ""
echo -n "ns1.vercel-dns.com -> "; dig +short A $DOM @ns1.vercel-dns.com | tr '\n' ' '; echo ""
echo -n "ns2.vercel-dns.com -> "; dig +short A $DOM @ns2.vercel-dns.com | tr '\n' ' '; echo ""
echo -n "8.8.8.8 -> "; dig +short A $DOM @8.8.8.8 2>&1 | tr '\n' ' '; echo ""
echo -n "1.1.1.1 -> "; dig +short A $DOM @1.1.1.1 2>&1 | tr '\n' ' '; echo ""
echo "=== my egress IP (visto por victim3) ==="
timeout 6 curl -s --max-time 5 https://api.ipify.org 2>/dev/null; echo ""
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (s as any).name);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });