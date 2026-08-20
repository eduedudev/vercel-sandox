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

const tests = [
  { ports: [3000, 8080] },
  { ports: [3000, 26661] },
  { ports: [26661] },
  { ports: [3000, 1] },
  { ports: [3000, 65535] },
  { ports: [22] },
];
for (const t of tests) {
  const name = "expose-test-" + Date.now() + "-" + Math.floor(Math.random()*1000);
  try {
    const sbx = await Sandbox.create({
      name, token: VICTIM, teamId, projectId,
      source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
      ports: t.ports,
    });
    const doms = t.ports.map(p => { try { return `${p}=${sbx.domain(p)}`; } catch { return `${p}=ERR`; } });
    console.log(`OK ports=${t.ports.join(",")} ${doms.join(" ")}`);
    try { await sbx.delete(); } catch {}
  } catch (e) {
    console.log(`ERR ports=${t.ports.join(",")} ${(e as Error).message.slice(0,100)}`);
  }
}
