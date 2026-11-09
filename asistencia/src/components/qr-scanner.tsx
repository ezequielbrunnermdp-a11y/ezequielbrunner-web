"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X, CameraOff } from "lucide-react";

/** Escáner de QR con la cámara trasera (funciona en iOS Safari y Android Chrome). */
export function QrScanner({ onResult, onCancel }: { onResult: (text: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (done.current) return;
          if (v.readyState >= 2 && v.videoWidth) {
            const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data && /v1\.[\w-]+\./.test(code.data)) {
              done.current = true;
              navigator.vibrate?.(40);
              onResult(code.data);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError"
            ? "No se permitió usar la cámara. Habilitala en los ajustes del navegador para escanear el código."
            : "No se pudo abrir la cámara de este dispositivo. Usá la terminal del local.",
        );
      }
    })();
    return () => {
      done.current = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <span className="text-sm font-medium">Escaneá el QR de la pantalla del local</span>
        <button onClick={onCancel} aria-label="Cancelar" className="rounded-full bg-white/10 p-2"><X className="size-5" /></button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-white/80">
            <CameraOff className="size-10" />{error}
          </div>
        ) : (
          <>
            <video ref={video} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="size-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,.45)]" />
            </div>
          </>
        )}
      </div>
      <p className="px-6 py-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-center text-xs text-white/70">
        El código cambia cada pocos segundos. Sólo es válido para el local donde se muestra.
      </p>
    </div>
  );
}
