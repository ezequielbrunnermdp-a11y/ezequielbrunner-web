// Conversión de imágenes a data URL JPEG/PNG compatibles con el motor de PDF.
export async function toPdfImage(url: string, maxSide = 900, mime: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    let bmp: ImageBitmap | HTMLImageElement;
    try {
      bmp = await createImageBitmap(blob);
    } catch {
      // SVG u otros: decodificar con <img>
      const objUrl = URL.createObjectURL(blob);
      bmp = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objUrl;
      });
    }
    const w0 = 'naturalWidth' in bmp ? bmp.naturalWidth || 600 : bmp.width;
    const h0 = 'naturalHeight' in bmp ? bmp.naturalHeight || 200 : bmp.height;
    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext('2d')!;
    if (mime === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(bmp as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mime, 0.8);
  } catch {
    return null;
  }
}

/** Misma imagen con todos sus píxeles visibles en blanco (para fondos oscuros). */
export async function toWhiteImage(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
