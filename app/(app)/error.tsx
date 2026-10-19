"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center" role="alert">
      <AlertTriangle className="size-6 text-warning" aria-hidden />
      <h1 className="font-semibold">Algo deu errado</h1>
      <p className="text-sm text-fg-3">Não foi possível exibir esta página. Verifique sua conexão e tente novamente.</p>
      <Button variant="primary" onClick={reset}>
        Tentar novamente
      </Button>
    </Card>
  );
}
