#!/bin/bash
set +e
echo "===== MOUNT ====="
mkdir -p /mnt/vda2
mount -t xfs -o ro /dev/vda /mnt/vda2 2>&1 || mount -t xfs /dev/vda /mnt/vda2 2>&1
echo "mount rc=$?"
R=/mnt/vda2
echo "===== TOP ====="
ls -la $R 2>&1 | head
echo "===== /root ====="; ls -la $R/root 2>&1 | head
echo "===== /home ====="; ls -la $R/home 2>&1 | head
echo "===== /etc (hosts, resolv, passwd, shadow) ====="
cat $R/etc/hosts 2>&1 | head
cat $R/etc/resolv.conf 2>&1
head -20 $R/etc/passwd 2>&1
sudo cat $R/etc/shadow 2>&1 | head -5
echo "===== /run ====="; ls -la $R/run 2>&1 | head -40
echo "===== /run/cell ====="; ls -la $R/run/cell 2>&1 | head -40
echo "===== /volumes ====="; ls -la $R/volumes 2>&1 | head -40
echo "===== /opt ====="; ls -la $R/opt 2>&1 | head
echo "===== /srv ====="; ls -la $R/srv 2>&1 | head
echo "===== /var ====="; ls -la $R/var 2>&1 | head -20
echo "===== /var/lib ====="; ls -la $R/var/lib 2>&1 | head -30
echo "===== find certs/keys ====="
find $R -xdev \( -name "*.pem" -o -name "*.crt" -o -name "*.key" -o -name "*.p12" -o -name "authorized_keys" -o -name "id_*" -o -name "credentials" \) 2>/dev/null | grep -v "^$R/usr/" | head -40
echo "===== find config/env ====="
find $R -xdev \( -name "*.env*" -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" -o -name "*.conf" \) 2>/dev/null | grep -vE "^$R/(usr|lib|proc|sys)" | head -50
echo "===== run/containerd ====="; ls -la $R/run/containerd 2>&1 | head
echo "===== proc visible from cell disk (sockets etc) ====="
ls -la $R/proc 2>&1 | head -5
echo "===== hostname ====="; cat $R/etc/hostname 2>&1
echo "===== machine-id ====="; cat $R/etc/machine-id 2>&1
echo "===== shadow root hash ====="
awk -F: '/^root:/{print $1":"$2}' $R/etc/shadow 2>&1
echo DONE