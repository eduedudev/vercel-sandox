import { APIClient } from "/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js";
import { readFileSync } from "fs";
let T = "";
try { T = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? ""; } catch {}
if (!T) { try { T = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? ""; } catch {} }
const client = new APIClient({ token: T, teamId: "team_bi7zLiwN9ULZQklHh3rlmq7D", projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A" });
const res = await client.listSessions({ projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A", limit: 50 });
const sessions: any[] = (res as any).sessions ?? (res as any).data ?? [];
console.log("sessions:", sessions.length);
for (const s of sessions) {
  const name = (s as any).name ?? (s as any).sandboxName;
  if (name?.includes("recon")) {
    try {
      await client.stopSandbox({ name, projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A" });
      console.log("stopped", name);
    } catch (e) { console.log("stop fail", name, (e as Error).message.slice(0,80)); }
  } else {
    console.log("skip", name);
  }
}
