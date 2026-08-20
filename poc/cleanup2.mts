import { readFileSync } from "fs";
let T = "";
try { T = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? ""; } catch {}
if (!T) { try { T = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? ""; } catch {} }
const base = "https://vercel.com/api";
const h = { Authorization: `Bearer ${T}`, "Content-Type": "application/json" };
const q = "teamId=team_bi7zLiwN9ULZQklHh3rlmq7D&projectId=prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
const res = await fetch(`${base}/v2/sandboxes/sessions?${q}`, { headers: h });
const data = await res.json() as any;
const sessions = Array.isArray(data) ? data : (data.sessions ?? data.data ?? []);
console.log("sessions:", sessions.length);
for (const s of sessions) {
  const name = (s as any).name ?? (s as any).sandboxName;
  if (name?.includes("recon")) {
    try {
      await fetch(`${base}/v2/sandboxes/${name}/stop?${q}`, { method: "POST", headers: h });
      console.log("stopped", name);
    } catch (e) { console.log("stop fail", name); }
  }
}
