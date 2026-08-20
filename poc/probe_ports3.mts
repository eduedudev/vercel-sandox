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
    name: "ports2-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const dom = sbx.domain(3000);
  const SCRIPT = `
set +e
echo "=== listeners actuales ==="
ss -tln 2>/dev/null | grep -E ':(3000|30001|30002|30003|23456)\\b'
echo "=== arrancar un http server simple en 3000 y 30000 ==="
echo -n "3000: "; timeout 3 bash -c 'cat /dev/tcp/127.0.0.1/3000 </dev/null >/dev/null 2>&1' && echo abierto || echo cerrado
echo "=== files del template ==="
ls 2>/dev/null | head -10
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 30_000 });
  console.log("DOMAIN=" + dom);
  console.log("NAME=" + (sbx as any).name);
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });