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

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  console.log("policy:", JSON.stringify(sbx.networkPolicy));
  const res = await sbx.runCommand("bash", ["-c", `
set +e
which mtr 2>/dev/null; which python3
echo "=== A. python UDP traceroute to google.com (default UDP) ==="
timeout 30 python3 - << 'PYEOF'
import socket, struct, time
targets = ["google.com", "172.31.0.2", "100.64.0.1", "172.31.16.7", "18.232.1.245"]
for t in targets:
    try:
        dst = socket.gethostbyname(t)
    except Exception as e:
        print(t, "resolve error", e); continue
    print(f"--- traceroute {t} ({dst}) ---")
    for ttl in range(1, 11):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)
        s.settimeout(2)
        t0 = time.time()
        try:
            s.sendto(b"x"*16, (dst, 33434+ttl))
            data, addr = s.recvfrom(512)
            dt = (time.time()-t0)*1000
            print(f"  ttl={ttl} {addr[0]} {dt:.0f}ms")
            if addr[0] == dst:
                print(f"  -> reached {dst}")
                s.close(); break
        except socket.timeout:
            print(f"  ttl={ttl} *")
        except Exception as e:
            print(f"  ttl={ttl} ERR {e}")
        s.close()
        if ttl >= 10: break
    time.sleep(0.2)
PYEOF
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
