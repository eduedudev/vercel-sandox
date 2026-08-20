#!/usr/bin/env bash
set +e
echo "=== 1. MI dominio resuelto por distintos resolvers ==="
for res in 172.31.0.2 100.64.0.1 8.8.8.8 1.1.1.1; do
  echo "--- resolver $res ---"
  dig +short A $MYSUB @$res 2>/dev/null | head -5
  dig +short CNAME $MYSUB @$res 2>/dev/null | head -3
done
echo ""
echo "=== 2. zonas internas: probar sufijos con mi subdominio ==="
SUB=$(echo "$MYSUB" | cut -d. -f1)
for suf in ".internal" ".ec2.internal" ".sandbox.internal" ".cell.internal" ".vercel.internal" ".svc.internal" ".run.internal" ".host.internal"; do
  for base in "$SUB" "sb-1cx1dcarx9qe" "sb-1phoxyil6njl"; do
    r=$(dig +short A "${base}${suf}" @172.31.0.2 2>/dev/null | head -1)
    [[ -n "$r" ]] && echo "HIT ${base}${suf} -> $r"
  done
done
echo "--- PTR de mi IP de celda ---"
myip=$(ip -o addr | grep 'eth0' | grep -oE 'inet [0-9.]+' | awk '{print $2}')
echo "mi ip celda: $myip"
dig +short -x $myip @172.31.0.2 2>/dev/null
echo ""
echo "=== 3. DNS sobre la red de celdas: preguntar a 100.64.0.1 como DNS del propio pod ==="
dig +short A $MYSUB @100.64.0.1 +time=2 +tries=1 2>&1 | head -3
echo ""
echo "=== 4. consultar NS del TLD run y vercel.run ==="
dig +short NS run. @172.31.0.2 2>/dev/null | head -3
dig +short NS vercel.run @172.31.0.2 2>/dev/null | head -3
echo ""
echo "=== 5. mi dominio via DNS publico normal ==="
getent hosts $MYSUB
echo "=== DONE ==="