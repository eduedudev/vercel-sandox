#!/bin/bash
set +e
echo "===== write probe on init.sock (python) ====="
timeout 10 python3 -c "
import socket, struct, time
SOCK='/run/vercel/share/init.sock'
def connect():
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(2)
    s.connect(SOCK)
    return s
payloads = []
payloads.append(('raw hello', b'hello'))
payloads.append(('raw braces', bytes([123,125])))
payloads.append(('raw json cmd', b'{\"cmd\":\"id\"}'))
pl = b'{\"cmd\":\"id\"}'
payloads.append(('4-byte-len', struct.pack('>I', len(pl)) + pl))
payloads.append(('json-line', b'{\"cmd\":\"id\"}' + bytes([10])))
for label, data in payloads:
    try:
        s = connect()
        s.sendall(data)
        time.sleep(0.3)
        try:
            r = s.recv(4096)
            print(label, '->', repr(r[:200]))
        except socket.timeout:
            print(label, '-> (timeout, no reply)')
        s.close()
    except Exception as e:
        print(label, '-> ERR', e)
try:
    s = connect()
    time.sleep(0.5)
    try:
        r = s.recv(4096)
        print('read-after-connect ->', repr(r[:200]))
    except socket.timeout:
        print('read-after-connect -> (nothing)')
    s.close()
except Exception as e:
    print('read-after-connect ERR', e)
"
echo "===== DONE ====="