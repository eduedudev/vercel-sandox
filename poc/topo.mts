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

const SCRIPT = `
set +e
echo "=== 1. confirmar MAC propia vs vecino IPv6 ==="
echo "mi MAC: $(ip link show eth0 | grep -oE 'link/ether [0-9a-f:]+' | awk '{print $2}')"
echo "mi IPv6: $(ip -6 addr show eth0 | grep inet6 | head -1)"
echo ""
echo "=== 2. ping multicast ff02::1 y ver quien responde (3 rondas) ==="
for i in 1 2 3; do
  timeout 2 ping6 -c 1 -W 1 ff02::1%eth0 2>&1 | grep "bytes from" | head -3
done
echo ""
echo "=== 3. el vecino responde a unicast? reintento con Neighbor Solicitation ==="
echo "--- borrar cache y re-descubrir ---"
ip -6 neigh flush dev eth0 2>/dev/null
for i in 1 2 3; do timeout 1 ping6 -c 1 -W 1 ff02::1%eth0 >/dev/null 2>&1; done
ip -6 neigh 2>/dev/null
echo "--- unicast directo 5 veces ---"
for i in 1 2 3 4 5; do
  timeout 2 ping6 -c 1 -W 1 fe80::c8:26ff:fe70:c282%eth0 2>&1 | tail -1
  sleep 0.3
done
echo ""
echo "=== 4. el gateway tiene IPv6? derivar de su MAC y probar ==="
gwm=$(ip neigh | grep 100.64.0.1 | awk '{print $5}')
echo "gateway MAC: $gwm"
echo "--- probar links locales IPv6 del gateway derivadas de la MAC ---"
timeout 2 ping6 -c 1 -W 1 "fe80::${gwm:0:2}${gwm:3:2}:ff:fe${gwm:6:2}${gwm:9:2}:${gwm:12:2}${gwm:15:2}%eth0" 2>&1 | tail -1
echo ""
echo "=== 5. retraceroute para ver si la topologia es estable ==="
which traceroute >/dev/null 2>&1 && traceroute -n -w 1 -q 1 -m 8 sb-1phoxyil6njl.vercel.run 2>&1 | head -10 || echo "no traceroute"
echo ""
echo "=== 6. esas IPs internas responden a ping directo? ==="
for ip in 244.5.6.111 240.4.112.71 240.0.236.2 242.13.116.73; do
  timeout 2 ping -c 1 -W 1 $ip 2>&1 | grep -oE "(bytes from [0-9.]+|time to live exceeded|100% packet loss)" | head -1
  echo "  $ip"
done
echo "=== DONE ==="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "topo-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 90_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });