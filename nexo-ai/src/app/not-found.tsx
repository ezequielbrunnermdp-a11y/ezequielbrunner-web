import { SearchX } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <EmptyState icon={<SearchX className="size-5" />} title="No encontramos esta página" action={<LinkButton href="/dashboard">Volver al panel</LinkButton>}>
        Puede que el elemento haya sido eliminado o que pertenezca a otra empresa.
      </EmptyState>
    </div>
  );
}
