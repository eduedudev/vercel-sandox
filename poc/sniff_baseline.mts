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
import { APIClient } from "/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js";

const SCRIPT = `
set +e
echo "=== BASELINE: capturar MI PROPIO trafico mientras hago ping al gateway ==="
timeout 6 python3 -c "
import socket, struct, subprocess, threading, time
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
s.bind(('eth0', 0))
s.settimeout(5)
def ping():
    for i in range(5):
        subprocess.run(['ping','-c','1','-W','1','100.64.0.1'], capture_output=True)
        time.sleep(0.3)
t = threading.Thread(target=ping); t.start()
try:
    for i in range(50):
        pkt, addr = s.recvfrom(2048)
        eth = pkt[:14]
        src = ':'.join('%02x'%b for b in eth[6:12])
        dst = ':'.join('%02x'%b for b in eth[0:6])
        etype = struct.unpack('>H', eth[12:14])[0]
        print('frame', i, 'src', src, 'dst', dst, 'etype', hex(etype))
except socket.timeout:
    print('>>> SIN FRAMES capturados ni siquiera los propios')
" 2>&1 | head -25
echo ""
echo "=== VECINO: re-ping multicast y probar unicast 5 veces ==="
for i in 1 2 3; do timeout 1 ping6 -c 1 -W 1 ff02::1%eth0 >/dev/null 2>&1; done
ip -6 neigh 2>/dev/null
echo "--- unicast a fe80::c8:26ff:fe70:c282%eth0 (5 intentos) ---"
for i in 1 2 3 4 5; do
  timeout 2 ping6 -c 1 -W 1 fe80::c8:26ff:fe70:c282%eth0 >/dev/null 2>&1 && echo "UNICAST RESPONDE" && break
  sleep 0.2
done
echo "--- TCP a fe80::c8:26ff:fe70:c282%eth0 puertos comunes ---"
for p in 22 80 443 3000 8080; do
  timeout 2 bash -c "timeout 0.8 bash -c 'echo > /dev/tcp/fe80::c8:26ff:fe70:c282%eth0/$p' 2>/dev/null && echo OPEN $p" || true
done
echo ""
echo "=== probar que el gateway tenga IPv6 link-local derivada de su MAC 22:2d:3d:37:5e:4c ==="
timeout 2 ping6 -c 1 -W 1 "fe80::202d:3dff:fe37:5e4c%eth0" 2>&1 | tail -1
echo "=== DONE ==="
`;

async function main() {
  const client = new APIClient({ token: VICTIM, teamId, projectId });
  const l: any = await client.listSandboxes({ projectId, limit: 50 });
  const sbxs = l.json?.sandboxes ?? l.json ?? [];
  const target = sbxs.find((s: any) => s.name?.startsWith("ipv6-"));
  const name = target?.name ?? "ipv6-" + Date.now();
  let s: any;
  if (target) { s = await Sandbox.get({ name, token: VICTIM, teamId, projectId }); }
  else { s = await Sandbox.create({ name, token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" }, ports: [3000] }); }
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 60_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });