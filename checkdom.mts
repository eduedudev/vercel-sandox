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
  console.log("sesiones del proyecto victima:", sbs.length);
  for (const s of sbs) {
    console.log("-", s.id, s.status, "name:", s.sourceSandboxName ?? s.name ?? "?", "ports?", s.ports ?? s.portMapping ?? JSON.stringify(s).slice(0,80));
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
