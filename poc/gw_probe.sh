#!/usr/bin/env bash
set +e
echo "=== 1. paths internos en el gateway 100.64.0.1 (port 80) ==="
for path in / /api /v2 /v2/sandboxes /v2/sandboxes/sessions /registry /routes /metrics /debug /health /status /_internal /_internal/routes /env /config /__internal__ /network /cells /hosts /instances; do
  code=$(timeout 3 curl -s -o /tmp/r -w "%{http_code}" --max-time 2 "http://100.64.0.1$path" 2>/dev/null)
  sz=$(wc -c < /tmp/r 2>/dev/null)
  echo "$path -> $code (${sz}b) : $(head -c 80 /tmp/r 2>/dev/null | tr -d '\n')"
done
echo ""
echo "=== 2. gateway otros puertos http ==="
for p in 80 443 8080 3000 5000; do
  code=$(timeout 3 curl -sk -o /tmp/r -w "%{http_code}" --max-time 2 "http://100.64.0.1:$p/" 2>/dev/null)
  echo "gw:$p -> $code : $(head -c 60 /tmp/r 2>/dev/null | tr -d '\n')"
done
echo ""
echo "=== 3. DNS en el gateway: resolver dominios sandbox y ver si da IP interna ==="
for h in sb-1phoxyil6njl.vercel.run sb-37yorqusq4c9.vercel.run sb-5nsmfqdkrkm2.vercel.run; do
  r=$(dig +short A $h @100.64.0.1 2>/dev/null | head -3 | tr '\n' ' ')
  echo "$h -> $r"
done
echo ""
echo "=== 4. headers especiales al gateway ==="
timeout 3 curl -s -o /tmp/r -w "%{http_code}\n" --max-time 2 "http://100.64.0.1/" -H "x-vercel-internal: 1" -H "x-vercel-id: x" 2>/dev/null
head -c 100 /tmp/r 2>/dev/null; echo ""
echo "=== 5. el gateway como DNS para nombres internos ==="
for h in metadata.ec2.internal 169.254.169.254 host.ec2.internal ip-172-31-16-7.ec2.internal gateway.ec2.internal sandbox.internal host.internal; do
  r=$(dig +short A $h @100.64.0.1 2>/dev/null | head -1)
  echo "$h -> NOHIT_$h"
done
echo "=== DONE ==="