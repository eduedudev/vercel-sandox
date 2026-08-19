import { Sandbox } from "@vercel/sandbox";
import { writeFile } from "fs/promises";

async function main() {
  const sandbox = await Sandbox.create({
    resources: { vcpus: 1 },
    timeout: 10 * 60_000,
  });
  console.log("SANDBOX:", sandbox.name);
  console.log("SESSION:", (sandbox as any).session?.sessionId);

  const buf = await sandbox.readFileToBuffer({
    path: "/run/vercel/share/sandbox-init",
  });
  if (buf) {
    await writeFile("/tmp/opencode/vercel/sandbox-init.bin", buf);
    console.log("DESCARGADO:", buf.length, "bytes");
  } else {
    console.log("NO SE PUDO LEER");
  }

  const probe = await sandbox.runCommand({
    cmd: "bash",
    args: ["-lc", "for p in 23456; do echo --PORT-$p--; curl -s -m 3 -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:$p/ 2>&1 | head -3; curl -s -m 3 http://127.0.0.1:$p/api/ 2>&1 | head -3; curl -s -m 3 http://127.0.0.1:$p/v1/ 2>&1 | head -3; done"],
    sudo: true,
    timeout: 20_000,
  });
  console.log("PROBE:", await probe.stdout());

  console.log("DONE");
}

main().catch(console.error);