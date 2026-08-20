import { readFileSync } from "fs";
const AUTH = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8"));
const PAT = AUTH.token;
async function main() {
  const team = "team_bi7zLiwN9ULZQklHh3rlmq7D";
  const proj = "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
  const r = await fetch(`https://vercel.com/api/v2/sandboxes/sessions?teamId=${team}&project=${proj}&limit=50`, {
    headers: { Authorization: `Bearer ${PAT}` }
  });
  const j = await r.json();
  const sbs = j.sessions ?? [];
  console.log("total sessions:", sbs.length);
  const byName: Record<string, any[]> = {};
  for (const s of sbs) {
    const k = s.sourceSandboxName ?? s.name ?? s.id;
    (byName[k] ??= []).push(s);
  }
  for (const [name, arr] of Object.entries(byName)) {
    const active = arr.filter(s => s.status === "running").length;
    console.log(`- ${name}: ${arr.length} sesiones (${active} activas), ultima: ${arr[0].status} region=${arr[0].region}`);
  }
  const active = sbs.filter(s => s.status === "running");
  console.log("running sessions:", active.length);
  console.log("ids:", sbs.map(s => s.id).join(","));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
