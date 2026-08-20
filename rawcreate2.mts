import { readFileSync } from "fs";
const AUTH = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8"));
const PAT = AUTH.token;
async function main() {
  const team = "team_bi7zLiwN9ULZQklHh3rlmq7D";
  const proj = "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";
  const r = await fetch(`https://vercel.com/api/v3/sandboxes?teamId=${team}&projectId=${proj}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "content-type": "application/json" },
    body: JSON.stringify({ projectId: proj, name: "raw-probe2", source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" }, ports: [3000] })
  });
  console.log("status:", r.status);
  console.log("body:", await r.text());
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
