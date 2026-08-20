import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
let T = "";
try { T = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? ""; } catch {}
if (!T) { try { T = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? ""; } catch {} }
const sessions = await Sandbox.listSessions({ token: T, teamId: "team_bi7zLiwN9ULZQklHh3rlmq7D", projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A" });
console.log("sessions:", sessions.length);
for (const s of sessions) {
  const name = (s as any).name;
  if (name?.includes("recon")) {
    try { await (await Sandbox.get({ name, token: T, teamId: "team_bi7zLiwN9ULZQklHh3rlmq7D", projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A" })).stop(); console.log("stopped", name); } catch (e) { console.log("stop fail", name, (e as Error).message); }
  }
}
