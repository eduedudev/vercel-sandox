const url = "wss://sb-1cx1dcarx9qe.vercel.run/ws/interactive";
const token = "FpDVacjH3C7I_UwYZQ9GddzdUQIGE9PTdphvqNOXndM";
try {
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
  const t = setTimeout(() => { console.log("TIMEOUT sin datos"); ws.close(); process.exit(0); }, 8000);
  ws.onopen = () => { console.log("WS OPEN"); ws.send(JSON.stringify({ type: "ping" })); };
  ws.onmessage = (e) => { console.log("WS MSG:", String(e.data).slice(0, 300)); };
  ws.onerror = (e) => { console.log("WS ERROR:", (e as any).message ?? "?"); };
  ws.onclose = (e) => { console.log("WS CLOSE:", e.code, e.reason); clearTimeout(t); process.exit(0); };
} catch (e) {
  console.log("WS CREATE ERR:", (e as Error).message);
}
