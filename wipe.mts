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
  const names = [...new Set(sbs.map(s => s.sourceSandboxName ?? s.name ?? s.id))];
  console.log("sandboxes a borrar:", names);
  for (const name of names) {
    try {
      const d = await fetch(`https://vercel.com/api/v2/sandboxes/${encodeURIComponent(name)}?teamId=${team}&projectId=${proj}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${PAT}` }
      });
      console.log(`DEL ${name} -> ${d.status}`);
    } catch (e) { console.log(`DEL ${name} -> ERR ${(e as Error).message}`); }
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
