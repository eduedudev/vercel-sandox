# Sandbox host implementation disclosure via unprivileged /proc/cmdline, dmesg, kallsyms, and the host VPC DNS resolver

## Summary

Any unprivileged workload running inside a **default** Vercel Sandbox (fresh `ubuntu` template, default `allow-all` network policy, no custom image, **no container escape**) can read the sandbox's host build fingerprint and the EC2 host's VPC topology straight from guest-visible state:

- `/proc/cmdline` (world-readable) leaks `build_version` (exact host image build hash), `cell_id` (hive cell identifier, `hvc_iad1_*`), and the host's VPC DNS server `172.31.0.2`.
- `dmesg` leaks the exact guest kernel build (`Linux 6.18.40 (root@buildkitsandbox) ... #1 SMP Wed Jul 29 22:20:41 UTC 2026`) and the full boot command line.
- `/proc/kallsyms` is readable (KASLR not applied to symbol addresses from the sandbox).
- The host's VPC DNS resolver `172.31.0.2` (listed in `/etc/resolv.conf`, injected via the `ip=` kernel parameter) is reachable and resolves the EC2 host's internal VPC hostname (`ip-172-31-16-7.ec2.internal → 172.31.16.7`) and the host's VPC egress public IP (via `o-o.myaddr.l.google.com` TXT → `3.239.152.190`).

This is host build + configuration + topology disclosure with **no secrets exposed**, achieved from unprivileged code in the sandbox's default configuration — no known-primitive chaining required.

## Severity claim

Per the reto guidelines Low tier: *"Host implementation disclosure that materially narrows an attack path (host build, configuration, or topology) with no secrets exposed."*

The disclosure narrows an attack path to the exact EC2 instance and host build:
- exact `build_version` hash for the host image → targeted binary diffing for host-side bugs,
- exact `cell_id` (`hvc_iad1_...`) → hive cell + region (`iad1`),
- guest kernel version + kallsyms → targeted guest-kernel bug selection,
- host VPC internal IP `172.31.16.7` + VPC egress public IP → specific instance identification.

A fingerprint with no bearing on reachability is Informative; this one has direct bearing on reachability (the specific EC2 instance, its VPC IP and egress IP are disclosed), so it should be Low.

## Steps to reproduce

Run the following from any Vercel Sandbox project (a plain `ubuntu` template, default settings):

```bash
id                                            # uid=1000(ubuntu), no escape required
cat /proc/cmdline                             # build_version, cell_id, ip=...172.31.0.2
dmesg | head -1                               # kernel build + date
head -1 /proc/kallsyms                        # KASLR base
cat /etc/resolv.conf                          # nameserver 172.31.0.2
getent hosts ip-172-31-16-7.ec2.internal      # host VPC IP
dig +short TXT o-o.myaddr.l.google.com @172.31.0.2   # host egress public IP
```

Expected output (observed on 2026-08-20, two separate sessions/sandboxes):

```
uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),...,27(sudo),...

/proc/cmdline:
  build_version=2026.08.19-81ade84e0e1185cfa9c085b01f5ff42833c5eaf9
  cell_id=hvc_iad1_b5d62a97_56f29aa0fe574dbb99046d87d69d7f37   (session 1)
  cell_id=hvc_iad1_b5d62a97_c2e83008521047cbb3cfdabf8bb386d7   (session 2, fresh sandbox)
  ip=100.64.22.218::100.64.0.1:255.255.0.0:::off:172.31.0.2::

dmesg:
  Linux version 6.18.40 (root@buildkitsandbox) (gcc (Debian 12.2.0-14+deb12u1) 12.2.0, ...) #1 SMP Wed Jul 29 22:20:41 UTC 2026

/proc/kallsyms:
  ffffffff81000000 T srso_alias_untrain_ret

resolv.conf:
  #MANUAL
  nameserver 172.31.0.2

getent hosts ip-172-31-16-7.ec2.internal:
  172.31.16.7     ip-172-31-16-7.ec2.internal

dig +short TXT o-o.myaddr.l.google.com @172.31.0.2:
  "18.232.1.245"   (session A)
  "3.239.152.190"  (session B, fresh sandbox)
```

All of the above was executed **without sudo and without any container escape**, against a fresh `ubuntu`-template sandbox with the default `allow-all` network policy.

## Full scenario replication (origen → víctima)

### 0. Prerequisites

- A Vercel project with the Sandbox product enabled (control plane API is in scope).
- The `@vercel/sandbox` SDK (`npm i @vercel/sandbox`).
- Credentials: a Vercel OIDC token **or** a personal access token (PAT) from
  `~/.local/share/com.vercel.cli/auth.json`. Team/project IDs are derived from
  the JWT payload when using OIDC, or passed explicitly for a PAT.

> **Note on quotas:** the Hobby plan limits *snapshot storage*. Sandboxes are
> auto-snapshotted on stop, so repeated runs can hit
> `402 payment_required "Hobby plan usage limit exceeded for Snapshots Storage"`.
> Free storage by deleting sessions and snapshots first:
>
> ```bash
> # list + delete all sessions/snapshots for the project
> curl -s "https://vercel.com/api/v2/sandboxes/sessions?teamId=team_...&project=prj_...&limit=50" \
>   -H "Authorization: Bearer $PAT" | jq -r '.sessions[].id'
> curl -s -X DELETE "https://vercel.com/api/v2/sandboxes/snapshots/<snap_id>?teamId=team_...&projectId=prj_..." \
>   -H "Authorization: Bearer $PAT"
> ```
>
> Sandbox names are unique per project; deleted names may not be immediately
> reusable, so the repro script uses a unique `victim-repro-<timestamp>` name
> on every run.

### 1. Run the repro script

```bash
# ./poc/repro.sh              -> default policy (allow-all)
# ./poc/repro.sh --deny-all   -> network policy deny-all
bash poc/repro.sh
```

The script:
1. creates a fresh sandbox (`victim-repro-<timestamp>`, exposed port 3000),
2. reads the host-identity/topology leak **from inside** the sandbox (uid 1000,
   no sudo, no escape),
3. traces the network path **from the origin** to the sandbox's public domain,
4. exercises ingress (HTTP/HTTPS) to the exposed port,
5. stops and deletes the sandbox.

### 2. Leak read from inside the sandbox (unprivileged)

```bash
id                                            # uid=1000(ubuntu)
cat /proc/cmdline                             # cell_id, build_version, ip=...172.31.0.2
dmesg | head -1                               # kernel build + date
head -1 /proc/kallsyms                        # KASLR base
cat /etc/resolv.conf                          # nameserver 172.31.0.2
getent hosts ip-172-31-16-7.ec2.internal      # host VPC IP
dig +short TXT o-o.myaddr.l.google.com @172.31.0.2   # host egress public IP
```

### 3. From the origin (attacker / independent machine)

```bash
# network path to the victim's public sandbox domain
traceroute -n -w 1 -q 1 -m 10 sb-XXXXX.vercel.run

# ingress to the exposed port — works even under deny-all
curl -s -i --max-time 10 https://sb-XXXXX.vercel.run/ | head -12
# -> HTTP/2 200
#    server: Vercel
#    x-vercel-id: iad1::...
#    x-vercel-internal-path-type: sandbox
```

Observed path (2026-08-20):

```
traceroute sb-2h59ewha8q8n.vercel.run  (64.239.123.65 / 64.239.109.193)
 1  10.0.0.129
 2  181.211.37.49
 3  172.22.32.49
 4  10.80.1.38
 5  190.152.252.153
 6  10.9.2.1
 7+ *   (Vercel edge)
```

### 4. Observed results (2026-08-20)

Default policy (`allow-all`):

```
policy: undefined (default)
cell_id=hvc_iad1_b01540a2_c24ea219bd6d4bc591b2df5c82db969d
build_version=2026.08.19-81ade84e0e1185cfa9c085b01f5ff42833c5eaf9
host VPC: ip-172-31-16-7.ec2.internal -> 172.31.16.7
host egress IP: 3.209.84.92
egress (sandbox->example.com): 200
ingress (origin->domain): HTTP/2 200
```

Under `deny-all`:

```
egress (sandbox->example.com): 000  (blocked — policy holds for egress)
ingress (origin->domain): HTTP/2 200  (exposed port still reachable)
cell_id / build_version / VPC DNS / kallsyms: all still readable
```

## Additional finding: Vercel internal agent binary (`sandbox-init`) is downloadable and unstripped (2026-08-20)

Every sandbox runs Vercel's internal agent as PID 1:

```
/run/vercel/share/sandbox-init --socket=/run/vercel/share/init.sock --pubkey=<ed25519 pubkey>
```

The directory `/run/vercel/share/` (bind-mounted into the guest, owned by the
`ubuntu` user) contains the 16 MB Go binary **and** the init unix socket. The
binary can be downloaded by any sandbox user (it's served on an exposed port),
and it is **not stripped** — it ships full Go debug info, a `.symtab`, and
build paths. This discloses Vercel's internal sandbox runtime:

- Module: `github.com/vercel/bees/containers/sandbox-init` (Vercel internal
  container platform, "bees")
- Build source tree: `/app/containers/sandbox-init/{cmd,gen,internal}/...`
  (`main.go`, `listener.go`, `internal/auth/auth.go`,
  `internal/service/{spawn,interactive,reaper}.go`, ...)
- Internal RPC service: `vercel.sandbox.spawn.v1.SpawnService`
  (ConnectRPC, gRPC + JSON), with unary `Ping`/`Kill` and streaming
  `Spawn`/`SpawnInteractive`; message types `PtyInput`/`PtyOutput`
  (`PtyStart`/`PtyStarted`/`PtyResize`/`PtyOutput_Data`/`_Exit`), `SpawnEvent`
  (`_Started`/`_Stdout`/`_Stderr`/`_Exit`), `SpawnRequest`, `KillRequest`, ...
- Local control listeners: TCP `127.0.0.1:23456` (Go `http.ServeMux`, only
  control-plane routes) and unix socket `/run/vercel/share/init.sock` which
  serves the full `SpawnService`.
- Auth scheme (reverse-engineered from `internal/auth`): every RPC requires
  headers `signature` (base64 Ed25519) and `timestamp`; a nonce
  (`baseNonce`, `nonceSize`, `nonceMask`) is part of the signed message;
  public key is 32 bytes and injected at launch via `--pubkey`. Requests
  without them get `401 {"code":"unauthenticated","message":"missing signature
  header"}` (or `missing timestamp header`).
- PID 1 holds multiple sockets to the control plane (fds pointing at the
  gateway/edge) and reads `/sys/fs/cgroup/cpu.max` for sandbox CPU limits.

The auth is Ed25519 with the private key held by Vercel's control plane, so it
cannot be forged from inside; the RPC on `init.sock` requires a valid
signature. This is disclosure of Vercel's runtime internals (binary + protocol
+ auth design), with no secrets and no forged-access primitive. Severity:
informative-to-low (extends the existing disclosure: it gives a full map of the
sandbox's internal control surface).

### Confirmations from the binary analysis

- The edge/control-plane connects to the sandbox via the exposed domain; the
  interactive session (`wss://sb-*.vercel.run/ws/interactive`) is terminated by
  the edge which holds the signing key — the sandbox never sees the private key.
- No private keys or secrets are present in the sandbox filesystem (`/run`,
  `/var`, `/etc`, `/opt`, `/proc/1/environ`).
- The sandbox's init communicates with the control plane over TLS
  (`GRPC_DEFAULT_SSL_ROOTS_FILE_PATH` / CA bundles in `/proc/1/environ`).

## Additional topology observations (2026-08-20)

Beyond the core finding, the same unprivileged sandbox access reveals additional
internal network topology (no further access gained — reinforcing that these are
disclosure-only):

### a) Vercel internal backbone `240.0.0.0/4` visible from inside any sandbox

A traceroute from **inside** a sandbox toward any `sb-*.vercel.run` domain shows
the internal routing path through Vercel's backbone, using IP space reserved for
private use (RFC 1112, `240.0.0.0/4`):

```
100.64.0.1      (cell gateway, hop 1)
244.5.6.111     (border router, TTL-exceed only)
240.4.112.71    (backbone, answers ICMP echo)
240.0.236.x     (backbone, answers ICMP echo)
242.13.116.73   (border router, TTL-exceed only)
64.239.123.x    (public edge)
```

The `240.4.112.x` / `240.0.236.x` routers answer ICMP echo but expose **no TCP
services** — nothing exploitable, purely topology disclosure. From the public
internet the same domains trace through ISP ranges (`181.211.x`, `190.152.x`),
so the backbone is only visible from inside a sandbox.

### b) Internal ingress node IP leaked in `x-forwarded-for`

A sandbox app receives an `X-Forwarded-For` chain that includes the **internal
ingress node** of Vercel's edge (an RFC1918 `10.128.0.0/16` address) alongside
the client IP:

```
"clientIp": "181.211.37.54, 10.128.180.118"
"x-forwarded-for": "181.211.37.54, 10.128.180.118"
```

The `10.128.x` hop rotates per request (`10.128.20.18`, `10.128.253.101`,
`10.128.217.92`, ...) — the ingress load-balancer pool. The sandbox also
receives `x-vercel-sandbox-host` (its own domain) and `x-vercel-sandbox-path`.

The internal node IP is **not reachable from the sandbox** (egress firewall
blocks `10.128.0.0/16`: ping 100% loss, no TCP, no traceroute hops) — the
ingress path is one-way (`edge → internal node → gateway → sandbox`).

### c) Per-sandbox egress public IP (identifiable, not attackable)

Each sandbox egresses through its own AWS us-east-1 public IP, discoverable
from inside (DNS TXT / ipify) or by another sandbox that observes the
`x-forwarded-for` of a shared app:

| sandbox | egress public IP | cell IP | hostname |
|---|---|---|---|
| session A | `3.237.28.239` | 100.64.60.225 | — |
| session B | `54.234.199.153` | 100.64.134.196 | `0424e5b5-dbd` |
| session C | `3.236.244.84` | — | `044da190-d41` |

All are AWS us-east-1 (`*.compute-1.amazonaws.com`). The egress IP is **not
ingress-capable**: connecting to it directly (any port, with or without Host)
never reaches the sandbox content — only the edge (via the `sb-*.vercel.run`
domain) routes to exposed ports. The "all ports SYN-ACK" seen on these IPs is
standard AWS NAT/firewall behavior (identical results on unrelated AWS IPs) —
a false positive, not an open service.

### d) Edge state oracle

The edge distinguishes sandbox states, leaking operational state to any client:

- `SANDBOX_NOT_LISTENING` — sandbox alive, port not listening
- `SANDBOX_STOPPED` — sandbox stopped
- normal response — sandbox alive and serving

Minor operational disclosure (victim's sandbox alive/stopped), no data.

### e) Cell network isolation confirmed

- ARP on the cell network (`100.64.0.0/16`) shows **only** the gateway; every
  other address fails ping/TCP. No shared L2, no neighbor pods.
- Promiscuous mode can be enabled but captures nothing — the segment is a
  point-to-point veth to the gateway (per-sandbox gateway MAC changes each run).
- IPv6 link-local shows only the sandbox's own interface (multicast `ff02::1`
  echo). No external IPv6 neighbor.
- Gateway `100.64.0.1` is a pure forwarder (no HTTP, no DNS service, no
  internal API).
- DNS for `sb-*.vercel.run` resolves only to public edge IPs, never to internal
  `100.64.x` / `172.31.x` / `10.128.x`, regardless of resolver used.

### f) DNS of `sb-*.vercel.run` — wildcard + edge IP rotation (no internal leak)

- Every `sb-<sub>.vercel.run` (and any other name) resolves to **2 of 8 public
  edge IPs**: `64.239.109.{1,65,129,193}` + `64.239.123.{1,65,129,193}`
  (NetName `VERCEL-11` / `VERCEL-10`, Vercel Inc). Each query returns a
  different 2-subset (round-robin / geo), identical from the sandbox's internal
  resolver (`172.31.0.2`), the public NS (`ns1/ns2.vercel-dns.com`), and
  external resolvers (8.8.8.8 / 1.1.1.1 / 9.9.9.9) — only the rotation order
  differs.
- `*.vercel.run` is a **wildcard DNS zone**: random names (`zzzz-nope-12345`,
  `64.239.109.65.vercel.run`) return NOERROR with edge IPs; no NXDOMAIN is
  possible. No AAAA, no CNAME, no TXT/SRV, no reverse DNS, AXFR denied.
- The internal resolver (`172.31.0.2`, host VPC) resolves `*.vercel.run`
  identically — it is not an internal DNS, it forwards to the public zone. It
  does **not** expose internal hostnames or IPs.
- Correlation with the observed topology: the edge IPs are the public
  front-door (the last hop of the internal traceroute path
  `100.64.0.1 → 244.5.6.111 → 240.4.112.71 → 240.0.236.x → 242.13.116.73 →
  64.239.123.x`), and they are reachable/ICMP-pingable from inside the sandbox
  (~1ms). The internal ingress nodes (`10.128.0.0/16`) and backbone
  (`240.0.0.0/4`) are **never** resolvable and never returned by the NS — they
  are strictly private.

### g) Full public-IP map of Vercel's edge (cross-domain correlation)

Vercel runs a single anycast edge. `vercel.com`, `v0.app`, `vercel.live`,
`v0sdk.com`, `*.vercel.run` (all sandbox domains), `vusercontent.net`,
`blobs/uploads.vusercontent.net`, `vercel-scripts.com`, `v0.build` all resolve
to the same 8 public IPs:

```
64.239.109.{1,65,129,193}  +  64.239.123.{1,65,129,193}
```

- NetName `VERCEL-11` / `VERCEL-10` (Vercel Inc, US); no reverse DNS.
- A port-443 scan of the whole `64.239.0.0/16` from inside a sandbox
  (parallel sockets) found only these two /24s plus two unrelated ISPs
  (`64.239.31.0/24` Athena Security, `64.239.37.0/24` Silicon Prairie — same
  prefix, different owners, `gw.sppx.io`).
- Other Vercel infra: `blob.vercel-storage.com` → CNAME `cname.vercel-dns.com`
  → `76.76.21.22` / `66.33.60.129`; DNS NS `76.76.21.x` / `66.33.60.x`;
  `vercel.app` → `216.198.79.131` / `64.29.17.131`; `vercel.run` apex →
  `198.169.2.x`.
- The internal resolver `172.31.0.2` returns the same public edge IPs (only
  rotation order differs); it never leaks `10.128.x` (ingress) or `240.0.0.0/4`
  (backbone) — those are strictly private and only observable via
  `x-forwarded-for` / traceroute.

### h) Edge port mapping — only the declared port is exposed

- `sb-<name>.vercel.run` resolves to the 8 edge IPs; the **public edge only
  maps the port declared in `ports:[...]`** (here 3000): `https://sb-*.vercel.run/`
  proxies straight to the guest's declared port (verified: a `python -m
  http.server 3000` in the guest is reachable from the Internet as the page
  served on `:443`).
- Explicit `:3000`, `:30001`, `:30002`, `:30003`, `:23456` on the domain → `000`
  (not mapped). The `sandbox-init` listeners (`30001/30002/30003/23456`) are
  **guest-internal only** and isolated from the edge.
- Cold-start behavior: the edge returns `000` until the guest actually listens
  on the declared port; `443`/`80` return `308` while cold and `200` once the
  app is up.
- `localhost:30001` = Go ServeMux (404 on all paths); `30002`/`30003` = raw TCP
  (no HTTP) — presumably control-plane channels; `23456` = Go ServeMux (404),
  same handler set as `30001`. No additional RPC surface is exposed on TCP.

## Why this is not already covered by Known findings

The published Known list covers container→guest escapes and post-escape host surface, including *"CAP_SYS_ADMIN + unrestricted /proc/sys writes (kernel sysctl surface, dmesg / kptr leaks)"*. That class requires the **escaped** context (CAP_SYS_ADMIN after a namespace escape) to read dmesg/kptr.

This finding requires **no escape**: a stock workload (uid 1000) in the default image reads `/proc/cmdline`, `dmesg`, and `/proc/kallsyms` directly, and additionally reaches the host's VPC DNS resolver to resolve the EC2 host's internal hostname and egress IP. The `/proc/cmdline` (`build_version`, `cell_id`) and host VPC DNS topology-disclosure components are not present in the published Known list.