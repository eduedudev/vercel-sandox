#!/usr/bin/env bash
set +e
echo "=== 1. confirmar MAC propia vs vecino IPv6 ==="
echo "mi MAC: $(ip link show eth0 | grep -oE 'link/ether [0-9a-f:]+' | awk '{print $2}')"
echo "mi IPv6: $(ip -6 addr show eth0 | grep inet6 | head -1)"
echo ""
echo "=== 2. ping multicast ff02::1 y ver quien responde (3 rondas) ==="
for i in 1 2 3; do
  timeout 2 ping6 -c 1 -W 1 ff02::1%eth0 2>&1 | grep "bytes from" | head -3
done
echo ""
echo "=== 3. el vecino responde a unicast? ==="
ip -6 neigh flush dev eth0 2>/dev/null
for i in 1 2 3; do timeout 1 ping6 -c 1 -W 1 ff02::1%eth0 >/dev/null 2>&1; done
ip -6 neigh 2>/dev/null
echo "--- unicast directo 5 veces ---"
for i in 1 2 3 4 5; do
  timeout 2 ping6 -c 1 -W 1 fe80::c8:26ff:fe70:c282%eth0 2>&1 | tail -1
  sleep 0.3
done
echo ""
echo "=== 4. gateway MAC (para referencia) ==="
ip neigh | grep 100.64.0.1
echo ""
echo "=== 5. retraceroute: topologia estable? ==="
if command -v traceroute >/dev/null 2>&1; then
  traceroute -n -w 1 -q 1 -m 8 sb-1phoxyil6njl.vercel.run 2>&1 | head -10
else
  echo "no traceroute"
fi
echo ""
echo "=== 6. esas IPs internas responden a ping directo? ==="
for ip in 244.5.6.111 240.4.112.71 240.0.236.2 242.13.116.73; do
  r=$(timeout 2 ping -c 1 -W 1 $ip 2>&1 | grep -oE "(bytes from [0-9.]+|time to live exceeded|100% packet loss)" | head -1)
  echo "$ip -> $r"
done
echo "=== DONE ==="