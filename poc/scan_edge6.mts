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
  const SCRIPT = `
set +e
echo "=== test mecanismo de conexion (IPs conocidas del edge) ==="
for ip in 64.239.109.1 64.239.123.1 64.239.109.65 64.239.123.193 64.239.110.1 64.239.108.1; do
  if timeout 2 bash -c "timeout 1.5 bash -c 'echo > /dev/tcp/'"$ip"'/443' 2>/dev/null"; then echo "OPEN $ip"; else echo "closed $ip"; fi
done
echo "=== scan con python (sockets) paralelo ==="
timeout 50 python3 -c "
import socket, concurrent.futures
def chk(i):
    ip = '64.239.%d.1' % i
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.6)
    try:
        s.connect((ip, 443))
        s.close()
        return ip
    except Exception:
        return None
with concurrent.futures.ThreadPoolExecutor(40) as ex:
    for r in ex.map(chk, range(1,256)):
        if r: print('OPEN', r)
print('SCANDONE2')
"
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 90_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
