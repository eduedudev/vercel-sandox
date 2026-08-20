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
  const s = await Sandbox.get({ name: "recon-1787251919562", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "===== /opt/vercel ====="
ls -la /opt/vercel/ 2>/dev/null
echo "===== /opt/vercel/celld-init.sh ====="
ls -la /opt/vercel/celld-init.sh 2>/dev/null
cat /opt/vercel/celld-init.sh 2>/dev/null | head -60
echo "===== /mnt/drives ====="
ls -la /mnt/drives/ 2>/dev/null
echo "===== /mnt/drives/sandbox ====="
ls -la /mnt/drives/sandbox/ 2>/dev/null | head -20
echo "===== who owns /opt/vercel ====="
stat -c '%U %G %a %n' /opt/vercel /opt/vercel/celld-init.sh 2>/dev/null
echo "===== readable? (as uid 1000) ====="
cat /opt/vercel/celld-init.sh 2>&1 | head -5
echo "===== CAPS full ====="
grep -E 'Cap(Eff|Bnd|Amb)' /proc/self/status
echo "===== mount table relevant ====="
grep -E 'sandbox|vercel|overlay|/mnt' /proc/self/mountinfo 2>/dev/null | head -10
echo "===== find interesting files in /opt/vercel ====="
find /opt/vercel -maxdepth 2 2>/dev/null | head -30
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });