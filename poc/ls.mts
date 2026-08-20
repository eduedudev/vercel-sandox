import { readFileSync } from "fs";
let T = "";
try { T = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? ""; } catch {}
if (!T) { try { T = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? ""; } catch {} }
const base = "https://vercel.com/api";
const h = { Authorization: `Bearer ${T}` };
const q = "teamId=team_bi7zLiwN9ULZQklHh3rlmq7D&projectId=prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
const res = await fetch(`${base}/v2/sandboxes/sessions?${q}&limit=50`, { headers: h });
console.log("status:", res.status);
const text = await res.text();
console.log(text.slice(0, 800));
