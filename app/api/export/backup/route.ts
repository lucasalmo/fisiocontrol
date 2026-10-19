import { isAuthenticated } from "@/lib/auth/session";
import { logServerError } from "@/lib/db/errors";
import { exportBackup } from "@/lib/db/repositories/backup";

/** Full JSON backup of every table. */
export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const backup = await exportBackup();
    const date = backup.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="fisiocontrol-backup-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("exportBackup", error);
    return Response.json({ error: "Não foi possível gerar o backup." }, { status: 500 });
  }
}
