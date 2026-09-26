
// ============================================================
// Content CRUD helpers
// Uses the admin's existing supabase client (from @/lib/supabase-client).
// All writes go directly to your Supabase database.
// The public website reads from these same tables automatically.
// ============================================================
import { supabase } from "@/lib/supabase-client";

export type Row = Record<string, unknown>;

export async function fetchRows(table: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Row[];
}

export async function createRow(table: string, row: Partial<Row>): Promise<Row> {
  const id = `${table.slice(0, 3)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const fullRow: Row = { id, ...row, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from(table).insert(fullRow).select().single();
  if (error) throw error;
  return data as Row;
}

export async function updateRow(table: string, id: string, patch: Partial<Row>): Promise<void> {
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderRows(table: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, idx) =>
      supabase.from(table).update({ order: idx }).eq("id", id)
    )
  );
}

