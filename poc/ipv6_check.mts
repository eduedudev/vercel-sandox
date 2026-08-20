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
echo "=== 1. MI MAC e IPv6 propios ==="
ip link show eth0 | grep link/ether
ip -6 addr show eth0 | grep inet6
echo ""
echo "=== 2. la MAC c8:26:fe:70:c2:82 es la mia? ==="
mymac=$(ip link show eth0 | grep -oE 'link/ether [0-9a-f:]+' | awk '{print $2}')
echo "mi MAC: $mymac"
echo ""
echo "=== 3. comparar con el vecino IPv6 reportado ==="
echo "vecino fe80::c8:26ff:fe70:c282 -> MAC derivada c8:26:fe:70:c2:82"
[[ "$mymac" == "c8:26:fe:70:c2:82" ]] && echo ">>> ES MI MISMA MAC: el 'vecino' era mi propia interfaz" || echo ">>> MAC distinta: vecino REAL"
echo ""
echo "=== 4. broadcast ARP completo + cuantos vecinos ==="
for i in 1 2 3 4; do timeout 1 ping -c 1 -b 100.64.255.255 >/dev/null 2>&1; done
ip neigh 2>/dev/null
echo ""
echo "=== 5. captura 8s de TODOS los frames (incluye el gateway) ==="
timeout 8 python3 -c "
import socket, struct
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
s.bind(('eth0', 0))
s.settimeout(6)
seen = {}
try:
    for i in range(50):
        pkt, addr = s.recvfrom(2048)
        eth = pkt[:14]
        src = ':'.join('%02x'%b for b in eth[6:12])
        dst = ':'.join('%02x'%b for b in eth[0:6])
        etype = struct.unpack('>H', eth[12:14])[0]
        key = (src, etype)
        seen[key] = seen.get(key, 0) + 1
except socket.timeout:
    pass
print('MACs observadas en 8s:')
for (src, et), n in sorted(seen.items()):
    print('  src', src, 'etype', hex(et), 'frames', n)
" 2>&1
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