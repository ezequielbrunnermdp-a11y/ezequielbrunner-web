import nodemailer from 'nodemailer';

let transporte;
function smtp() {
  if (!transporte) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

export const emailsPedidos = () =>
  (process.env.EMAILS_PEDIDOS || '').split(',').map((s) => s.trim()).filter(Boolean);

const remitente = () => process.env.EMAIL_FROM || `El Cóndor Pedidos <${process.env.SMTP_USER}>`;

/**
 * Envía un email. attachments: [{ filename, content: Uint8Array|Buffer }]
 * Usa Resend si hay RESEND_API_KEY; si no, Gmail/SMTP.
 */
export async function enviarEmail({ to, subject, html, text, attachments = [], replyTo }) {
  const destinos = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!destinos.length) return { ok: false, motivo: 'sin destinatarios' };

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remitente(), to: destinos, subject, html, text, reply_to: replyTo,
        attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })),
      }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return { ok: true };
  }

  await smtp().sendMail({
    from: remitente(), to: destinos.join(', '), subject, html, text, replyTo,
    attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: 'application/pdf' })),
  });
  return { ok: true };
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Marco común de los emails
export function plantilla(titulo, contenidoHtml) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#2a2622">
<div style="max-width:600px;margin:0 auto;padding:16px">
  <div style="background:#5a2e1a;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0">
    <div style="font-size:20px;font-weight:bold;letter-spacing:1px">EL CÓNDOR</div>
    <div style="font-size:13px;opacity:.85">Panadería tradicional · Mar del Plata</div>
  </div>
  <div style="background:#fff;padding:18px;border-radius:0 0 10px 10px;font-size:15px;line-height:1.5">
    <h1 style="font-size:19px;margin:0 0 12px">${esc(titulo)}</h1>
    ${contenidoHtml}
  </div>
</div></body></html>`;
}
