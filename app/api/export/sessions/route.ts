import { isAuthenticated } from "@/lib/auth/session";
import { logServerError } from "@/lib/db/errors";
import { SESSIONS_PAGE_SIZE, listSessions } from "@/lib/db/repositories/sessions";
import { formatDateBR } from "@/lib/dates/format";
import { sessionFiltersSchema, type SessionFilters } from "@/lib/validation/schemas";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralize spreadsheet formulas and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV export of sessions (same filters as the list). */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = sessionFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
  const filters: SessionFilters = parsed.success ? { ...parsed.data, page: undefined } : {};
  try {
    const rows = [];
    for (let page = 1; ; page++) {
      const { items, total } = await listSessions({ ...filters, sort: filters.sort ?? "asc", page });
      rows.push(...items);
      if (page * SESSIONS_PAGE_SIZE >= total) break;
    }
    const header = ["Data", "Ciclo", "Nº no ciclo", "Nº global", "Status", "Categoria", "Observações"];
    const lines = rows.map((s) =>
      [
        formatDateBR(s.sessionDate),
        s.cycleNumber,
        s.numberInCycle,
        s.globalNumber ?? "",
        s.status === "completed" ? "Concluída" : "Pendente",
        s.categoryName ?? "",
        s.notes ?? "",
      ]
        .map(csvCell)
        .join(";"),
    );
    // BOM + semicolon separator open correctly in spreadsheet apps configured for pt-BR.
    const body = "﻿" + [header.map(csvCell).join(";"), ...lines].join("\r\n");
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fisiocontrol-sessoes.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("exportSessions", error);
    return Response.json({ error: "Não foi possível exportar as sessões." }, { status: 500 });
  }
}
