import { Sandbox } from "@vercel/sandbox";

async function main() {
  const sandbox = await Sandbox.create({
    source: {
      url: "https://github.com/vercel/sandbox-example-next.git",
      type: "git",
    },
    resources: { vcpus: 1 },
    ports: [3000],
  });


  console.log(`Starting the development server...`);
  await sandbox.runCommand({
    cmd: "traceroute",
    args: ["google.com"],
    cwd: "sandbox-example-next",
    stderr: process.stderr,
    stdout: process.stdout,
    detached: true,
  });
}

main().catch(console.error);