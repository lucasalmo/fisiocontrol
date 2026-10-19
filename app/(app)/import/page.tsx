import type { Metadata } from "next";
import { Suspense } from "react";
import { DataError, PageSkeleton } from "@/components/feedback/states";
import { ImportHistory } from "@/components/import/import-history";
import { PageHeader } from "@/components/ui/primitives";
import { load } from "@/lib/data/load";
import { getSettings } from "@/lib/db/repositories/settings";

export const metadata: Metadata = { title: "Importar histórico" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Importar histórico"
        description="Converta sua lista em texto em sessões, ciclos, bônus e eventos. Repetir a importação não duplica registros."
      />
      <Suspense fallback={<PageSkeleton rows={1} />}>
        <ImportContent />
      </Suspense>
    </>
  );
}

async function ImportContent() {
  const result = await load("import", getSettings);
  if (!result.ok) return <DataError message={result.error} />;
  // Suggest the surgery year: the history usually starts around it.
  const defaultYear = Number((result.data.surgeryDate ?? new Date().toISOString()).slice(0, 4));
  return <ImportHistory defaultYear={defaultYear} />;
}
