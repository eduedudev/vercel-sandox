import { readFileSync } from "fs";
const AUTH = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8"));
const PAT = AUTH.token;
async function main() {
  const team = "team_bi7zLiwN9ULZQklHh3rlmq7D";
  const proj = "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
  const r = await fetch(`https://vercel.com/api/v2/sandboxes/sessions?teamId=${team}&project=${proj}&limit=50`, {
    headers: { Authorization: `Bearer ${PAT}` }
  });
  console.log("status:", r.status);
  const j = await r.json();
  const sbs = j.sandboxes ?? j.sessions ?? j;
  console.log(JSON.stringify(j).slice(0, 1500));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
