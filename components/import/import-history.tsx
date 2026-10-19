"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, FileUp, Info, Pencil, RefreshCw, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { executeImportAction, previewImportAction } from "@/features/import/actions";
import type { ImportPreview, ImportResult, PreviewLine } from "@/features/import/service";
import { useAction } from "@/hooks/use-action";
import { formatDateBR } from "@/lib/dates/format";
import { cn } from "@/lib/utils/text";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Textarea, buttonClass } from "@/components/ui/primitives";

const EXAMPLE = `[ ] ====== Cirurgia dia 31/03 ======
[✓] 35 - Segunda 03/08 - Habilidade
[✓] 36 - Quarta 05/08 - Intensidade
[ ] => Ganhei 3 sessões por zerar o eletro
[ ] ==== PAGAMENTO + 40 SESSÕES 26/08 ====
[✓] 17 - Sexta 16/10 - Adaptado explosão
[ ] 18 - Segunda 19/10`;

function describe(line: PreviewLine): string {
  const d = line.data;
  if (!d) return "—";
  switch (d.kind) {
    case "session":
      return `Sessão ${d.number} · ${d.date ? formatDateBR(d.date) : "sem data"} · ${d.completed ? "concluída" : "pendente"}${
        d.categoryName ? ` · ${d.categoryName}${d.newCategory ? " (nova)" : ""}` : ""
      }${d.notes ? ` · ${d.notes}` : ""}`;
    case "payment":
      return `Pagamento · ${d.date ? formatDateBR(d.date) : "sem data"} · ${d.baseLimit} sessões`;
    case "bonus":
      return `Bônus +${d.quantity} · ${d.date ? formatDateBR(d.date) : "sem data"} · ${d.reason}`;
    case "event":
      return `${d.type === "surgery" ? "Cirurgia" : d.type === "holiday" ? "Feriado" : d.type === "pause" ? "Pausa" : d.type === "resume" ? "Retorno" : "Evento"} · ${
        d.date ? formatDateBR(d.date) : "sem data"
      } · ${d.title}`;
    case "note":
      return `Observação → linha ${d.attachToLine}: ${d.text}`;
  }
}

function lineTone(line: PreviewLine) {
  if (line.state === "excluded") return "excluded";
  if (line.issues.some((i) => i.level === "error")) return "error";
  if (line.db === "duplicate" || line.db === "skip") return "duplicate";
  if (line.issues.some((i) => i.level === "warning")) return "warning";
  return "ok";
}

export function ImportHistory({ defaultYear }: { defaultYear: number }) {
  const { pending, run } = useAction();
  const [text, setText] = useState("");
  const [year, setYear] = useState(String(defaultYear));
  const [initialCycle, setInitialCycle] = useState("auto");
  const [initialLimit, setInitialLimit] = useState("");
  const [createCategories, setCreateCategories] = useState(true);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [stale, setStale] = useState(false);
  const [editing, setEditing] = useState<{ line: number; value: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const options = useMemo(
    () => ({
      referenceYear: Number(year),
      excludedLines: excluded,
      initialCycle: initialCycle === "auto" || initialCycle === "new" ? initialCycle : Number(initialCycle),
      initialBaseLimit: initialLimit ? Number(initialLimit) : undefined,
      createCategories,
    }),
    [year, excluded, initialCycle, initialLimit, createCategories],
  );

  function analyze(nextText = text, nextExcluded = excluded) {
    setError(null);
    setResult(null);
    run(() => previewImportAction(nextText, { ...options, excludedLines: nextExcluded }), {
      silent: true,
      onSuccess: (r) => {
        setPreview(r.data ?? null);
        setStale(false);
      },
      onError: (r) => setError(r.error),
    });
  }

  function markStale() {
    if (preview) setStale(true);
  }

  function toggleExcluded(lineNumber: number) {
    const next = excluded.includes(lineNumber) ? excluded.filter((n) => n !== lineNumber) : [...excluded, lineNumber];
    setExcluded(next);
    analyze(text, next);
  }

  function saveEdit() {
    if (!editing) return;
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    lines[editing.line - 1] = editing.value.replace(/[\r\n]+/g, " ");
    const nextText = lines.join("\n");
    setText(nextText);
    setEditing(null);
    analyze(nextText);
  }

  function cancel() {
    setPreview(null);
    setExcluded([]);
    setEditing(null);
    setError(null);
    setStale(false);
  }

  function confirmImport() {
    setError(null);
    run(() => executeImportAction(text, options), {
      onSuccess: (r) => {
        setResult(r.data ?? null);
        setPreview(null);
        setExcluded([]);
      },
      onError: (r) => setError(r.error),
    });
  }

  if (result) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden />
          <div>
            <h2 className="font-semibold">Importação concluída</h2>
            <p className="mt-1 text-sm text-fg-2">
              {result.sessions} sessões, {result.cycles} ciclos, {result.bonuses} bônus, {result.events} eventos e{" "}
              {result.categories} categorias criadas. {result.skipped} registros já existiam e foram ignorados.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/timeline" className={buttonClass("primary")}>
                Ver linha do tempo
              </Link>
              <Link href="/sessions" className={buttonClass("secondary")}>
                Ver sessões
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setText("");
                }}
              >
                Nova importação
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const visibleLines = preview
    ? preview.lines.filter((l) => showAll || (l.state !== "ignored"))
    : [];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="1. Cole o histórico"
          description="Uma linha por registro. Aceita [✓], [x], [X] e [ ]; tolera diferenças de espaços, maiúsculas e acentos."
          icon={<FileUp className="size-4" />}
        />
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <Field label="Histórico em texto" htmlFor="history">
            <Textarea
              id="history"
              rows={12}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                markStale();
              }}
              placeholder={EXAMPLE}
              className="font-mono text-[13px]"
              spellCheck={false}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Ano de referência"
              htmlFor="year"
              hint="Ano da primeira data sem ano. Viradas de ano são sinalizadas na prévia."
            >
              <Input
                id="year"
                type="number"
                min={1990}
                max={2100}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  markStale();
                }}
              />
            </Field>
            <Field label="Linhas antes do 1º pagamento" htmlFor="initialCycle" hint="Ciclo dessas sessões.">
              <Select
                id="initialCycle"
                value={initialCycle}
                onChange={(e) => {
                  setInitialCycle(e.target.value);
                  markStale();
                }}
              >
                <option value="auto">Automático (ciclo atual ou novo)</option>
                <option value="new">Criar novo ciclo</option>
                {preview?.existingCycles
                  .slice()
                  .reverse()
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      Ciclo existente {c.cycleNumber}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Limite do ciclo inicial" htmlFor="initialLimit" hint="Vazio = padrão das configurações.">
              <Input
                id="initialLimit"
                type="number"
                min={1}
                max={1000}
                value={initialLimit}
                onChange={(e) => {
                  setInitialLimit(e.target.value);
                  markStale();
                }}
              />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="createCategories"
                type="checkbox"
                checked={createCategories}
                onChange={(e) => {
                  setCreateCategories(e.target.checked);
                  markStale();
                }}
                className="size-4 accent-[var(--accent)]"
              />
              <label htmlFor="createCategories" className="text-[13px] text-fg-2">
                Criar categorias desconhecidas
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => analyze()} disabled={pending || !text.trim()}>
              <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
              {preview ? "Analisar novamente" : "Analisar e pré-visualizar"}
            </Button>
            {!text ? (
              <Button variant="ghost" onClick={() => setText(EXAMPLE)}>
                Usar exemplo
              </Button>
            ) : null}
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      </Card>

      {preview ? (
        <Card>
          <CardHeader
            title="2. Revise a prévia"
            description="Nada foi gravado ainda. Corrija ou exclua as linhas sinalizadas."
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
                  <Undo2 className="size-4" aria-hidden /> Cancelar
                </Button>
              </div>
            }
          />
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            {stale ? (
              <Alert tone="warning">As opções ou o texto mudaram. Analise novamente antes de importar.</Alert>
            ) : null}
            <div className="flex flex-wrap gap-2 text-[13px]">
              <Badge tone="accent">{preview.counts.sessions} sessões</Badge>
              <Badge tone="info">{preview.counts.cycles} ciclos novos</Badge>
              <Badge tone="accent">{preview.counts.bonuses} bônus</Badge>
              <Badge tone="neutral">{preview.counts.events} eventos</Badge>
              <Badge tone="neutral">{preview.counts.categories} categorias novas</Badge>
              <Badge tone="neutral">{preview.counts.duplicates} já existentes</Badge>
              {preview.counts.warnings ? <Badge tone="warning">{preview.counts.warnings} avisos</Badge> : null}
              {preview.counts.errors ? <Badge tone="danger">{preview.counts.errors} erros</Badge> : null}
            </div>
            {preview.segments.filter((s) => s.action !== "none").length ? (
              <div className="flex flex-wrap gap-2 text-[13px] text-fg-2">
                {preview.segments
                  .filter((s) => s.action !== "none")
                  .map((s) => (
                    <span key={s.index} className="rounded-lg border border-border px-2 py-1">
                      Bloco {s.index + 1}: <strong className="font-medium text-fg">{s.label}</strong> · limite {s.limit}
                    </span>
                  ))}
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="bg-surface-2 text-fg-3">
                  <tr>
                    <th className="w-10 px-2 py-2 font-medium">Incl.</th>
                    <th className="w-12 px-2 py-2 font-medium">Linha</th>
                    <th className="px-2 py-2 font-medium">Interpretação</th>
                    <th className="w-36 px-2 py-2 font-medium">Ciclo</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibleLines.map((line) => {
                    const tone = lineTone(line);
                    const isEditing = editing?.line === line.lineNumber;
                    return (
                      <tr
                        key={line.lineNumber}
                        className={cn(
                          "border-t border-border align-top",
                          tone === "error" && "bg-danger-soft/60",
                          tone === "warning" && "bg-warning-soft/50",
                          (tone === "excluded" || tone === "duplicate" || line.state === "ignored") && "text-fg-3",
                        )}
                      >
                        <td className="px-2 py-2">
                          {line.state !== "ignored" ? (
                            <input
                              type="checkbox"
                              checked={line.state !== "excluded"}
                              onChange={() => toggleExcluded(line.lineNumber)}
                              disabled={pending}
                              aria-label={`Incluir linha ${line.lineNumber}`}
                              className="size-4 accent-[var(--accent)]"
                            />
                          ) : null}
                        </td>
                        <td className="px-2 py-2 tabular">{line.lineNumber}</td>
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <form
                              className="flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                saveEdit();
                              }}
                            >
                              <Input
                                autoFocus
                                value={editing.value}
                                onChange={(e) => setEditing({ line: line.lineNumber, value: e.target.value })}
                                className="font-mono text-[13px]"
                                aria-label={`Editar linha ${line.lineNumber}`}
                              />
                              <Button type="submit" size="sm" variant="primary">
                                Salvar
                              </Button>
                              <Button size="sm" onClick={() => setEditing(null)}>
                                Cancelar
                              </Button>
                            </form>
                          ) : (
                            <>
                              <p className="font-mono text-xs text-fg-3">{line.raw || "(vazia)"}</p>
                              {line.state === "ignored" ? null : line.state === "excluded" ? (
                                <p className="mt-0.5">Excluída pelo usuário</p>
                              ) : (
                                <p className="mt-0.5 text-fg">{describe(line)}</p>
                              )}
                              {line.state !== "excluded"
                                ? line.issues.map((issue, i) => (
                                    <p
                                      key={i}
                                      className={cn(
                                        "mt-1 flex items-start gap-1.5 text-xs",
                                        issue.level === "error" && "text-danger-strong",
                                        issue.level === "warning" && "text-warning",
                                        issue.level === "info" && "text-fg-3",
                                      )}
                                    >
                                      {issue.level === "error" ? (
                                        <CircleAlert className="mt-px size-3.5 shrink-0" aria-label="Erro" />
                                      ) : issue.level === "warning" ? (
                                        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-label="Aviso" />
                                      ) : (
                                        <Info className="mt-px size-3.5 shrink-0" aria-label="Informação" />
                                      )}
                                      {issue.message}
                                    </p>
                                  ))
                                : null}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-fg-3">{line.state === "ignored" ? "" : line.cycleLabel}</td>
                        <td className="px-2 py-2">
                          {!isEditing && line.state !== "ignored" ? (
                            <button
                              onClick={() => setEditing({ line: line.lineNumber, value: line.raw })}
                              className="rounded-md p-1 text-fg-3 hover:bg-surface-hover hover:text-fg"
                              aria-label={`Corrigir linha ${line.lineNumber}`}
                              title="Corrigir linha"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-fg-3">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-[var(--accent)]" />
              Mostrar linhas vazias e decorativas
            </label>

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-fg-3">
                {preview.canImport
                  ? "A importação é gravada em uma única transação: ou tudo é salvo, ou nada."
                  : preview.counts.errors
                    ? "Corrija ou exclua as linhas com erro para continuar."
                    : "Não há registros novos para importar."}
              </p>
              <div className="flex gap-2">
                <Button onClick={cancel} disabled={pending}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={confirmImport} disabled={pending || !preview.canImport || stale}>
                  {pending ? "Importando…" : "Confirmar importação"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
