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
echo "=== 1. vecino IPv6 detectado: fe80::c8:26ff:fe70:c282 ==="
ip -6 neigh 2>/dev/null
echo ""
echo "=== 2. resolver la MAC c8:26:fe:70:c2:82: vendor lookup (OUI) ==="
echo "OUI c8:26:fe -> buscar en /sys o arp"
grep -i "c8:26:fe" /proc/net/arp 2>/dev/null
echo ""
echo "=== 3. el vecino IPv6 responde a TCP? probar puertos en fe80::c8:26ff:fe70:c282 ==="
for p in 22 80 443 8080 3000 2379 7000 5000 10250 10000 23456 30001; do
  timeout 3 bash -c "timeout 1 bash -c 'echo > /dev/tcp/fe80::c8:26ff:fe70:c282%eth0/$p' 2>/dev/null && echo IPv6-OPEN $p" || true
done
echo ""
echo "=== 4. escanear TODOS los vecinos IPv6 (multicast all-nodes + solicited-node) ==="
echo "--- ping ff02::1 tres veces y ver quien aparece ---"
for i in 1 2 3; do timeout 1 ping6 -c 1 ff02::1%eth0 >/dev/null 2>&1; done
ip -6 neigh 2>/dev/null
echo ""
echo "=== 5. el gateway IPv6? escanear direcciones link-local probables ==="
echo "--- MAC del gateway IPv4 (arp): $(ip neigh | grep 100.64.0.1 | awk '{print $5}')"
gwm=$(ip neigh | grep 100.64.0.1 | awk '{print $5}')
if [ -n "$gwm" ]; then
  echo "--- IPv6 derivada de MAC $gwm ---"
  o1=$(echo $gwm | cut -d: -f1); o2=$(echo $gwm | cut -d: -f2)
  # invertir bit U/L
  inv=$(printf '%02x' $(( 0x$o1 ^ 0x02 )))
  ip6="fe80::$inv$o2:ff:fe"
  rest=$(echo $gwm | cut -d: -f3-6 | sed 's/:/:/g')
  echo "link-local posible: $ip6"
  timeout 3 ping6 -c 1 "fe80::$inv$o2:ff:fe$rest%eth0" 2>/dev/null | tail -1
fi
echo ""
echo "=== 6. probar ping directo a fe80::c8:26ff:fe70:c282 ==="
timeout 3 ping6 -c 2 fe80::c8:26ff:fe70:c282%eth0 2>&1 | tail -3
echo ""
echo "=== 7. ROUTING: la ruta por defecto usa IPv6? ==="
ip -6 route 2>/dev/null
echo ""
echo "=== 8. capturar 5s: ver si el vecino IPv6 manda trafico (ND/router adv) ==="
timeout 5 python3 -c "
import socket, struct
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x86dd))
s.bind(('eth0', 0))
s.settimeout(4)
try:
    for i in range(30):
        pkt, addr = s.recvfrom(2048)
        if len(pkt) < 40: continue
        src = ':'.join('%02x'%b for b in pkt[8:24])
        dst = ':'.join('%02x'%b for b in pkt[24:40])
        nh = pkt[6]
        print('IPv6 pkt src', src, 'dst', dst, 'nh', nh)
except socket.timeout:
    print('no IPv6 en 4s')
" 2>&1
echo "=== DONE ==="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "ipv6-" + Date.now(),
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