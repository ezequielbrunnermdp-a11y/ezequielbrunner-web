import { redirect } from "next/navigation";
/** Destino de la URL codificada en el QR (si el empleado lo escanea con la cámara nativa). */
export default async function Fichar({ searchParams }: { searchParams: Promise<{ qr?: string }> }) {
  const { qr } = await searchParams;
  redirect(qr && qr.length < 300 ? `/mi?qr=${encodeURIComponent(qr)}` : "/mi");
}
