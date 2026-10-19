import "server-only";
import { db, type Queryable } from "../client";
import { UserFacingError } from "../errors";
import { normalizeText } from "@/lib/utils/text";
import type { Category } from "@/types/domain";

type CategoryRow = {
  id: number;
  name: string;
  normalized_name: string;
  color: string;
  active: boolean;
  usage_count: number;
  last_used_on: string | null;
};

function map(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    normalizedName: r.normalized_name,
    color: r.color,
    active: r.active,
    usageCount: r.usage_count,
    lastUsedOn: r.last_used_on,
  };
}

export async function listCategories(options: { activeOnly?: boolean } = {}, tx: Queryable = db) {
  const { rows } = await tx.query<CategoryRow>(
    `SELECT c.id, c.name, c.normalized_name, c.color, c.active,
            COUNT(s.id)::int AS usage_count,
            MAX(s.session_date) AS last_used_on
       FROM session_categories c
       LEFT JOIN sessions s ON s.category_id = c.id
      WHERE ($1::boolean IS NOT TRUE OR c.active)
      GROUP BY c.id
      ORDER BY c.active DESC, lower(c.name)`,
    [options.activeOnly ?? false],
  );
  return rows.map(map);
}

export async function createCategory(name: string, color: string, tx: Queryable = db): Promise<number> {
  const normalized = normalizeText(name);
  const { rows } = await tx.query<{ id: number }>(
    `INSERT INTO session_categories (name, normalized_name, color) VALUES ($1, $2, $3) RETURNING id`,
    [name.trim().replace(/\s+/g, " "), normalized, color],
  );
  return rows[0].id;
}

export async function updateCategory(id: number, name: string, color: string) {
  const { rowCount } = await db.query(
    `UPDATE session_categories SET name = $2, normalized_name = $3, color = $4 WHERE id = $1`,
    [id, name.trim().replace(/\s+/g, " "), normalizeText(name), color],
  );
  if (!rowCount) throw new UserFacingError("Categoria não encontrada.");
}

/** Categories are deactivated, never silently deleted, so history stays intact. */
export async function setCategoryActive(id: number, active: boolean) {
  const { rowCount } = await db.query(`UPDATE session_categories SET active = $2 WHERE id = $1`, [id, active]);
  if (!rowCount) throw new UserFacingError("Categoria não encontrada.");
}

/** Hard delete is only allowed for categories never used by a session. */
export async function deleteUnusedCategory(id: number) {
  const { rows } = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM sessions WHERE category_id = $1`, [id]);
  if (rows[0].n > 0) {
    throw new UserFacingError("A categoria está associada a sessões. Desative-a em vez de excluir.");
  }
  await db.query(`DELETE FROM session_categories WHERE id = $1`, [id]);
}
