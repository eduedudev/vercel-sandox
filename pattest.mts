import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
const AUTH = JSON.parse(readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8"));
const PAT = AUTH.token;
async function main() {
  const sbx = await Sandbox.create({
    name: "pat-probe",
    token: PAT,
    teamId: "team_bi7zLiwN9ULZQklHh3rlmq7D",
    projectId: "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A",
    template: "ubuntu",
    ports: [3000],
  });
  console.log("OK id:", sbx.id, "domain:", sbx.domain(3000));
  await sbx.delete();
  console.log("deleted");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
