import { APIClient } from "/tmp/vercel-sandbox/node_modules/@vercel/sandbox/dist/api-client/api-client.js";
import { readFileSync } from "fs";
let T = "";
try { T = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? ""; } catch {}
if (!T) { try { T = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? ""; } catch {} }
const client = new APIClient({ token: T, teamId: "team_bi7zLiwN9ULZQklHh3rlmq7D", projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A" });
const res: any = await client.listSandboxes({ projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A", limit: 50 });
const sbxs: any[] = res.sandboxes ?? res.data ?? res.pagination ?? [];
console.log("raw keys:", Object.keys(res), "count:", sbxs.length);
for (const s of sbxs) {
  const name = s.name;
  console.log("found:", name);
}
