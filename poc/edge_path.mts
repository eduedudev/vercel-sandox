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
  const s = await Sandbox.get({ name: "dns-probe-1787253418569", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "===== traceroute interno al edge (via DNS interno) ====="
for ip in 64.239.123.193 64.239.109.65; do
  echo "--- traceroute a $ip ---"
  timeout 20 traceroute -n -w 1 -q 1 -m 12 $ip 2>&1 | head -12
done
echo ""
echo "===== ¿la IP del edge es alcanzable via backbone interno (240.x)? ====="
echo "Recordar camino: 100.64.0.1 -> 244.5.6.111 -> 240.4.112.71 -> 240.0.236.x -> 242.13.116.73 -> 64.239.123.x"
echo ""
echo "===== ping al edge (ICMP) ====="
timeout 5 ping -c 2 -W 2 64.239.123.193 2>&1 | tail -3
echo ""
echo "===== puertos del edge (443/80/23456/30001) ====="
for p in 443 80 23456 30001; do
  if timeout 3 bash -c "timeout 2 bash -c 'echo > /dev/tcp/64.239.123.193/$p' 2>/dev/null"; then echo "SYN-ACK $p"; else echo "no $p"; fi
done
echo ""
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });