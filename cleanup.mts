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
  // Reset victim-np to allow-all (operator's original posture)
  try {
    const np = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
    console.log("victim-np policy before cleanup:", JSON.stringify(np.networkPolicy));
    await np.updateNetworkPolicy("allow-all");
    console.log("victim-np reset to allow-all");
    await np.stop();
  } catch (e) { console.log("victim-np:", (e as Error).message); }

  // Stop leftover test sandboxes
  for (const name of ["victim-pol", "victim-pol-fork2", "victim-pol-r2"]) {
    try {
      const s = await Sandbox.get({ name, token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
      await s.stop();
      console.log("stopped", name);
    } catch (e) { console.log(name, ":", (e as Error).message); }
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
