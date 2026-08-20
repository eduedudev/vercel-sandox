import { Sandbox } from "@vercel/sandbox";
import { readFileSync, writeFileSync } from "fs";

function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local", "utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}

const VICTIM = loadToken();
if (!VICTIM) { console.error("no token"); process.exit(1); }
let V: any;
try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

const SRV = `
set +e
cat > /tmp/echo.py << 'PYEOF'
import socket, http.server, os
class H(http.server.BaseHTTPRequestHandler):
    def _r(self):
        body = (
            "peer=%s:%d\\n"
            "path=%s\\n"
            "host=%s\\n"
            "x-forwarded-for=%s\\n"
            "x-forwarded-host=%s\\n"
            "remote-env=%s\\n"
            "listen-addrs:\\n%s\\n"
            % (
                self.client_address[0], self.client_address[1],
                self.path,
                self.headers.get("Host", ""),
                self.headers.get("X-Forwarded-For", ""),
                self.headers.get("X-Forwarded-Host", ""),
                os.environ.get("VERCEL_OIDC_TOKEN", "")[:20],
                "\n".join("  " + l for l in os.popen("ip -o addr | grep inet").read().splitlines()[:4]),
            )
        ).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(body)
    do_GET = _r
    do_POST = _r
    do_HEAD = _r
    def log_message(self, *a): pass
srv = http.server.HTTPServer(("0.0.0.0", 3000), H)
print("echo server on 3000", flush=True)
srv.serve_forever()
PYEOF
nohup python3 /tmp/echo.py > /tmp/echo.log 2>&1 &
sleep 1
echo "server-listening"
echo "--- env ---"
env | grep -iE "vercel|oidc|token|broker" | sed 's/=.*/=REDACTED/'
echo "--- interfaces ---"
ip -o addr | grep inet
echo "--- routes ---"
ip route
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "ingress-echo-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const res = await sbx.runCommand("bash", ["-c", SRV], { wait: true, timeout: 30_000 });
  const out = await res.output("both");
  console.log(out);
  const dom3000 = sbx.domain(3000);
  writeFileSync("/tmp/ingress_domain.txt", dom3000);
  console.log("DOMAIN_3000=" + dom3000);
  console.log("KEEP_ALIVE=true");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });