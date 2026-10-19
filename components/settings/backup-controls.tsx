"use client";

import { Download, FileJson, Upload } from "lucide-react";
import { useState } from "react";
import { restoreBackupAction } from "@/features/import/actions";
import { useAction } from "@/hooks/use-action";
import { Alert, Button, Field, Input, buttonClass } from "@/components/ui/primitives";

export function BackupControls({ hasData }: { hasData: boolean }) {
  const { pending, run } = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"empty" | "replace">(hasData ? "replace" : "empty");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (!file) return;
    setError(null);
    const json = await file.text();
    run(() => restoreBackupAction(json, mode, confirmation), {
      onSuccess: () => {
        setFile(null);
        setConfirmation("");
      },
      onError: (r) => setError(r.error),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <a href="/api/export/backup" className={buttonClass("secondary")} download>
          <FileJson className="size-4" aria-hidden /> Exportar backup (JSON)
        </a>
        <a href="/api/export/sessions" className={buttonClass("secondary")} download>
          <Download className="size-4" aria-hidden /> Exportar sessões (CSV)
        </a>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Restaurar backup</p>
        <Field label="Arquivo de backup (.json)" htmlFor="backup-file">
          <Input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="h-auto py-1.5"
          />
        </Field>
        <fieldset className="flex flex-col gap-2 text-[13px]">
          <legend className="sr-only">Modo de restauração</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" checked={mode === "empty"} onChange={() => setMode("empty")} className="mt-0.5 accent-[var(--accent)]" />
            <span>
              <strong className="font-medium">Restaurar em banco vazio</strong> — recusado se já houver sessões ou ciclos.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-0.5 accent-[var(--accent)]" />
            <span>
              <strong className="font-medium">Substituir todos os dados</strong> — apaga sessões, ciclos, bônus, eventos e configurações atuais.
            </span>
          </label>
        </fieldset>
        {mode === "replace" ? (
          <Alert tone="danger" title="Ação irreversível">
            <p>Exporte um backup antes. Para confirmar, digite SUBSTITUIR:</p>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-2 max-w-48"
              aria-label="Digite SUBSTITUIR para confirmar"
            />
          </Alert>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div>
          <Button
            variant={mode === "replace" ? "danger" : "primary"}
            onClick={restore}
            disabled={pending || !file || (mode === "replace" && confirmation.trim().toUpperCase() !== "SUBSTITUIR")}
          >
            <Upload className="size-4" aria-hidden /> {pending ? "Restaurando…" : "Restaurar backup"}
          </Button>
        </div>
      </div>
    </div>
  );
}
