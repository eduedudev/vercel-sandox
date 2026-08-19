import { Sandbox } from "@vercel/sandbox";

const RECON = [
  "echo ====IDENTITY; whoami; id; hostname; uname -a",
  "echo ====OS; cat /etc/os-release | head -4",
  "echo ====CMD; cat /proc/cmdline",
  "echo ====CPU; grep -E 'model name|processor' /proc/cpuinfo | head -4",
  "echo ====MEM; head -3 /proc/meminfo",
  "echo ====ENV; env | sort",
  "echo ====CAPS; grep Cap /proc/self/status",
  "echo ====CGROUP; cat /proc/self/cgroup",
  "echo ====MOUNTS; cat /proc/mounts",
  "echo ====NET; ip addr 2>/dev/null || ifconfig -a 2>/dev/null || cat /proc/net/fib_trie | head -30",
  "echo ====ROUTES; ip route 2>/dev/null || route -n 2>/dev/null",
  "echo ====DNS; cat /etc/resolv.conf",
  "echo ====DEV; ls -la /dev/",
  "echo ====VSOCK; ls -l /dev/vsock 2>&1",
  "echo ====MMDS; curl -s -m 3 http://169.254.169.254/latest/meta-data/ 2>&1 | head -20",
  "echo ====FS; ls -la /; ls -la /vercel 2>&1; ls -la /volumes 2>&1; ls -la /opt 2>&1",
  "echo ====OIDC; env | grep -iE 'vercel|oidc|token' | sed 's/=.*/=<redacted>/'",
  "echo ====PROC; ps aux | head -30",
  "echo ====KERNEL; ls /proc/sys/kernel/ | head; cat /proc/sys/kernel/hostname",
  "echo ====EGRESS; curl -s -m 5 https://api.ipify.org; echo; curl -s -m 5 -o /dev/null -w 'google:%{http_code} %{time_total}s\n' https://google.com",
  "echo ====VSOCK2050; PY=$(echo aW1wb3J0IHNvY2tldA0KdHJ5Og0KICAgIHM9c29ja2V0LnNvY2tldChzb2NrZXQuQUZfVlNPQ0ssIHNvY2tldC5TT0NLX1NUUkVBTSkNCiAgICBzLnNldHRpbWVvdXQoNCkNCiAgICBzLmNvbm5lY3QoKDIsMjA1MCkpDQogICAgcy5zZW5kYWxsKGIne1wianNvbnJwY1wiOlwiMi4wXCIsXCJpZFwiOjEsXCJtZXRob2RcIjpcInJlYWRfcmVzb3VyY2VfdXNhZ2VcIixcInBhcmFtc1wiOnt9fVxuJykNCiAgICBwcmludCgndnNvY2syMDUwOicsIHMucmVjdig0MDk2KSkNCmV4Y2VwdCBFIGFzIGU6DQogICAgcHJpbnQoJ3Zzb2NrMjA1MCBFUlI6JywgdHlwZShlKS5fX25hbWVfXywgZSkNCg== | base64 -d; echo \"$PY\" | python3 2>&1",
  "echo ====SNIFF; ls /proc/1/root 2>&1 | head; readlink /proc/1/ns/* 2>&1",
];

async function main() {
  const sandbox = await Sandbox.create({
    resources: { vcpus: 1 },
    timeout: 10 * 60_000,
  });
  console.log("SANDBOX:", sandbox.name);
  console.log("SESSION:", (sandbox as any).session?.sessionId);
  for (const cmd of RECON) {
    try {
      const r = await sandbox.runCommand({
        cmd: "bash",
        args: ["-lc", cmd],
        sudo: true,
        timeout: 15_000,
      });
      console.log(`\n########## CMD: ${cmd.split(";")[0].replace("echo ====", "")} ##########`);
      console.log((await r.stdout()).slice(0, 4000));
      console.error((await r.stderr()).slice(0, 1500));
    } catch (e: any) {
      console.log(`\n[ERR] ${cmd.split(";")[0]}: ${e.message}`);
    }
  }
  console.log("\nDONE");
}

main().catch(console.error);