const url = "wss://sb-1cx1dcarx9qe.vercel.run/ws/interactive";
const token = "FpDVacjH3C7I_UwYZQ9GddzdUQIGE9PTdphvqNOXndM";

function tryConn(label: string, u: string, headers: Record<string,string>) {
  return new Promise<void>((resolve) => {
    console.log(`\n--- ${label}: ${u} ---`);
    try {
      const ws = new WebSocket(u, { headers });
      const t = setTimeout(() => { console.log("TIMEOUT"); try { ws.close(); } catch {} resolve(); }, 6000);
      ws.onopen = () => { console.log("OPEN"); try { ws.send(JSON.stringify({type:"ping"})); } catch {} };
      ws.onmessage = (e) => { console.log("MSG:", String(e.data).slice(0, 200)); clearTimeout(t); };
      ws.onerror = (e) => { console.log("ERR:", (e as any).message ?? String(e)); };
      ws.onclose = (e) => { console.log("CLOSE:", e.code, e.reason || "-"); clearTimeout(t); resolve(); };
    } catch (e) { console.log("CREATE ERR:", (e as Error).message); resolve(); }
  });
}

async function main() {
  await tryConn("token auth header", url, { Authorization: `Bearer ${token}` });
  await tryConn("token query", url + `?token=${token}`, {});
  await tryConn("sec-websocket-protocol", url, { "Sec-WebSocket-Protocol": token });
  await tryConn("no token", url, {});
}
main();
