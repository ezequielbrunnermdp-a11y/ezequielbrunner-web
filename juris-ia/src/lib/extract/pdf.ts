
type TextItem = { str: string; hasEOL?: boolean; transform?: number[] };

/** Extrae el texto de cada página de un PDF conservando la numeración de páginas. */
export async function extractPdfPages(buf: Buffer): Promise<{ page: number; text: string }[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await task.promise;
  const pages: { page: number; text: string }[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = "";
      let lastY: number | null = null;
      for (const raw of content.items as TextItem[]) {
        if (typeof raw.str !== "string") continue;
        const y = raw.transform?.[5] ?? null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 14 && !text.endsWith("\n")) {
          // Salto vertical grande: probable separación de párrafo.
          text += "\n";
        }
        text += raw.str;
        if (raw.hasEOL) text += "\n";
        if (y !== null) lastY = y;
      }
      pages.push({ page: i, text: normalize(text) });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

function normalize(t: string): string {
  return t
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
