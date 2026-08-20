import { readFileSync } from "fs";
const AUTH = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8"));
const PAT = AUTH.token;
console.log("PAT prefix:", PAT.slice(0, 10));
async function main() {
  // try listing sandboxes with PAT
  const r = await fetch("https://vercel.com/api/v2/sandboxes/sessions?teamId=team_bi7zLiwN9ULZQklHh3rlmq7D&project=prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A&limit=100", {
    headers: { Authorization: `Bearer ${PAT}` }
  });
  console.log("list status:", r.status);
  const txt = await r.text();
  console.log(txt.slice(0, 800));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
