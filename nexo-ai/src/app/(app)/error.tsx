"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = /permiso|pertenecés/i.test(error.message);
  return (
    <Card>
      <EmptyState
        icon={<AlertTriangle className="size-5" />}
        title={forbidden ? "Acceso no permitido" : "No pudimos cargar esta sección"}
        action={!forbidden && <Button onClick={reset}><RotateCcw className="size-4" />Reintentar</Button>}
      >
        {forbidden ? "Tu rol en esta empresa no permite ver esta sección." : "Ocurrió un error inesperado."}
        {error.digest && <span className="mt-2 block font-mono text-[11px] text-faint">Ref: {error.digest}</span>}
      </EmptyState>
    </Card>
  );
}
