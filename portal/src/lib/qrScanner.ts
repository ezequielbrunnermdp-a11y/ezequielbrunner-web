import jsQR from 'jsqr';

/**
 * Escáner de QR con la cámara trasera. Usa BarcodeDetector cuando existe
 * (Android/Chrome) y jsQR como alternativa universal (iOS Safari).
 */
export interface Scanner { stop: () => void }

export async function startScanner(video: HTMLVideoElement, onCode: (text: string) => void, onError: (e: Error & { name?: string }) => void): Promise<Scanner> {
  let stream: MediaStream | null = null;
  let raf = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch (e) {
    onError(e as Error);
    return { stop };
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play().catch(() => undefined);

  type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  const detector = BD ? new BD({ formats: ['qr_code'] }) : null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      try {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) { onCode(codes[0].rawValue); return; }
        } else if (ctx) {
          const w = Math.min(640, video.videoWidth), h = Math.round((w / video.videoWidth) * video.videoHeight);
          canvas.width = w; canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) { onCode(code.data); return; }
        }
      } catch { /* cuadro ilegible: se reintenta */ }
    }
    raf = requestAnimationFrame(() => void tick());
  };
  raf = requestAnimationFrame(() => void tick());
  return { stop };
}

/** El QR contiene una URL o un texto "EQ1:<sucursal>:<token>". */
export function parseQrPayload(text: string): { branchId: string; token: string } | null {
  const m = /^EQ1:([0-9a-f-]{36}):([A-Za-z0-9_-]{16,})$/.exec(text.trim());
  if (m) return { branchId: m[1]!, token: m[2]! };
  try {
    const u = new URL(text);
    const b = u.searchParams.get('b'), t = u.searchParams.get('t');
    if (b && t && /^[0-9a-f-]{36}$/.test(b)) return { branchId: b, token: t };
  } catch { /* no es URL */ }
  return null;
}
