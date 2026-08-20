import { readFileSync } from "fs";
const AUTH = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8"));
const PAT = AUTH.token;
async function main() {
  const team = "team_bi7zLiwN9ULZQklHh3rlmq7D";
  const proj = "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
  const r = await fetch(`https://vercel.com/api/v2/sandboxes/snapshots?teamId=${team}&project=${proj}&limit=50`, {
    headers: { Authorization: `Bearer ${PAT}` }
  });
  console.log("list status:", r.status);
  const j = await r.json();
  console.log(JSON.stringify(j).slice(0, 600));
  const snaps = j.snapshots ?? [];
  console.log("snapshots:", snaps.length);
  for (const s of snaps) {
    const id = s.snapshotId ?? s.id;
    const d = await fetch(`https://vercel.com/api/v2/sandboxes/snapshots/${id}?teamId=${team}&projectId=${proj}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${PAT}` }
    });
    console.log(`DEL snap ${id} -> ${d.status}`);
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
