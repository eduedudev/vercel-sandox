import socket, time, sys

targets = sys.argv[1:] if len(sys.argv) > 1 else ["google.com"]
for t in targets:
    try:
        dst = socket.gethostbyname(t)
    except Exception as e:
        print(t, "resolve error", e); continue
    print(f"--- traceroute {t} ({dst}) ---")
    for ttl in range(1, 11):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)
        s.settimeout(2)
        t0 = time.time()
        try:
            s.sendto(b"x"*16, (dst, 33434+ttl))
            data, addr = s.recvfrom(512)
            dt = (time.time()-t0)*1000
            print(f"  ttl={ttl} {addr[0]} {dt:.0f}ms")
            if addr[0] == dst:
                print(f"  -> reached {dst}")
                s.close(); break
        except socket.timeout:
            print(f"  ttl={ttl} *")
        except Exception as e:
            print(f"  ttl={ttl} ERR {e}")
        s.close()
    time.sleep(0.2)
print("TRACE-DONE")