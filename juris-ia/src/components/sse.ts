/** Lee una respuesta Server-Sent Events de un POST. */
export async function postSSE(url: string, body: unknown, onEvent: (event: string, data: any) => void, signal?: AbortSignal) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    let msg = `Error ${res.status}`;
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = raw.match(/^event: (.*)$/m)?.[1] ?? "message";
      const data = raw.match(/^data: (.*)$/m)?.[1];
      if (data) onEvent(ev, JSON.parse(data));
    }
  }
}
