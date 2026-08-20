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
    name: "ferreos-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "===== mi IP / gateway / vecinos ====="
ip -4 addr show 2>/dev/null | grep inet
ip route 2>/dev/null | head -5
cat /proc/net/route 2>/dev/null | head -5
echo ""
echo "===== scan ICMP de la celda 100.64.0.0/16 (ping broadcast?) ====="
ping -c1 -W1 -b 100.64.255.255 2>&1 | tail -3
echo ""
echo "===== ping a gateway y router interno ====="
ping -c1 -W1 100.64.0.1 2>&1 | tail -2
echo ""
echo "===== traceroute a varios destinos (ampliar mapa backbone) ====="
for dst in 64.239.123.193 64.239.109.65 8.8.8.8 1.1.1.1 100.64.0.1; do
  echo "--- traceroute a $dst ---"
  timeout 15 bash -c "traceroute -n -m 12 -w 1 $dst 2>/dev/null || (command -v tracepath >/dev/null && tracepath -m 12 $dst 2>/dev/null) || echo 'sin traceroute'" 2>&1 | head -14
done
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 90_000 });
  console.log("NAME=" + (sbx as any).name);
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });