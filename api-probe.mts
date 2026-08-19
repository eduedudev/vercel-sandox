import { Sandbox } from "@vercel/sandbox";

const TOKEN = process.env.VERCEL_OIDC_TOKEN!;

function claims() {
  const p = JSON.parse(Buffer.from(TOKEN.split(".")[1], "base64url").toString());
  return p;
}

async function probe(label: string, url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      "user-agent": "recon/0.1",
      ...init?.headers,
    },
  });
  const text = await r.text();
  const safe = text.length > 1200 ? text.slice(0, 1200) + "…" : text;
  console.log(`\n### ${label}\nURL: ${url}\nSTATUS: ${r.status}\n${safe}`);
}

async function main() {
  const claims = process.env.VERCEL_OIDC_TOKEN
    ? JSON.parse(
        Buffer.from(process.env.VERCEL_OIDC_TOKEN.split(".")[1], "base64url").toString(),
      )
    : {};
  console.log("CLAIMS:", JSON.stringify(claims));

  // Crear un sandbox para tener un ID propio
  const sandbox = await Sandbox.create({
    resources: { vcpus: 1 },
    name: "api-probe",
    timeout: 5 * 60_000,
  });
  const session: any = (sandbox as any).session;
  const sid = session?.sessionId;
  const sname = sandbox.name;
  console.log("SESSION:", sid, "NAME:", sname);

  const base = "https://vercel.com/api";
  const team = claims.owner_id || "";

  await probe("GET sessions (propias)", `${base}/v2/sandboxes/sessions?project=${claims.project_id || ""}&limit=5&teamId=${team}`);
  await probe("GET sandboxes (propias)", `${base}/v2/sandboxes?project=${claims.project_id || ""}&limit=5&teamId=${team}`);
  await probe("GET session por id", `${base}/v2/sandboxes/sessions/${sid}?teamId=${team}`);
  await probe("GET sandbox por nombre", `${base}/v2/sandboxes/${sname}?projectId=${claims.project_id || ""}&teamId=${team}`);
  await probe("GET sandbox por SESSION (¿cross?)", `${base}/v2/sandboxes/${sid}?projectId=${claims.project_id || ""}&teamId=${team}`);
  await probe("GET snapshots", `${base}/v2/sandboxes/snapshots?project=${claims.project_id || ""}&limit=5&teamId=${team}`);

  console.log("\nDONE");
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});