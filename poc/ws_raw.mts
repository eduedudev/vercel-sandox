const token = "FpDVacjH3C7I_UwYZQ9GddzdUQIGE9PTdphvqNOXndM";
const host = "sb-1cx1dcarx9qe.vercel.run";
const paths = [
  { p: "/ws/interactive?token=" + token, label: "interactive token query" },
  { p: "/ws/interactive", label: "interactive no token" },
];
import { createConnection } from "net";
import tls from "tls";

function handshake(label: string, p: string, withToken: boolean) {
  return new Promise<void>((resolve) => {
    const key = Buffer.from(Math.random().toString()).toString("base64");
    const req = [
      `GET ${p} HTTP/1.1`,
      `Host: ${host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      withToken ? `Authorization: Bearer ${token}` : "",
      withToken ? `Sec-WebSocket-Protocol: ${token}` : "",
      "",
      "",
    ].join("\r\n");
    console.log(`\n--- ${label} ---`);
    const sock = tls.connect({ host, port: 443, servername: host }, () => {
      sock.write(req);
    });
    let buf = "";
    sock.on("data", (d) => { buf += d.toString("latin1"); });
    sock.on("end", () => { console.log(buf.split("\r\n").slice(0, 25).join("\n")); resolve(); });
    sock.on("error", (e) => { console.log("TLS ERR:", e.message.slice(0, 120)); resolve(); });
    setTimeout(() => { try { sock.destroy(); } catch {} console.log("(timeout) " + buf.split("\r\n").slice(0, 25).join("\n")); resolve(); }, 6000);
  });
}

async function main() {
  await handshake("token en query", "/ws/interactive?token=" + token, false);
  await handshake("token en auth header", "/ws/interactive", true);
  await handshake("sin token", "/ws/interactive", false);
  await handshake("token en query + auth", "/ws/interactive?token=" + token, true);
}
main();
