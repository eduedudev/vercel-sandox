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
    name: "egress2-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "=== egress de ESTE sandbox nuevo ==="
dig +short TXT o-o.myaddr.l.google.com @172.31.0.2 2>/dev/null | head -2
timeout 6 curl -s --max-time 5 https://api.ipify.org 2>/dev/null; echo ""
echo "=== mi IP celda ==="
ip -o addr | grep eth0 | grep inet
echo "=== mi hostname ==="
hostname
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });