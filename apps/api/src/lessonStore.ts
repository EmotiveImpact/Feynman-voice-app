// The lesson catalogue in Neon (table "lessons", see apps/api/schema.sql).
//
// Every lesson the server writes is saved. General topic lessons (no notes,
// nothing the learner said) are shared: the next person asking for the same
// topic, idea and level gets the saved one straight away, at no Claude cost.
// Lessons built from someone's own notes or words are saved privately for
// review and never served to anyone else. Their notes are not stored.
//
// The catalogue is a helper, never a gate: if Neon is slow or down, lessons
// are written as before.
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { CostLine } from "./pricing";

type Env = Record<string, string | undefined>;

export interface SavedLesson {
  id: number;
  model: string;
  lesson: unknown;
}

export interface LessonRow {
  key: string;
  shared: boolean;
  topic: string;
  idea: string;
  level: string;
  notesHash: string | null;
  model: string;
  lesson: unknown;
  cost: CostLine[];
  problems: string[];
}

export interface LessonStore {
  /** The newest live shared lesson for this key, no older than maxAgeDays. */
  find(key: string, maxAgeDays: number): Promise<SavedLesson | null>;
  save(row: LessonRow): Promise<void>;
  served(id: number): Promise<void>;
  retire(id: number, reason: string): Promise<void>;
}

/** Lower case, letters and numbers only, single spaces: "Cell Membranes!" and "cell membranes" match. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”'"`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The catalogue key for a general lesson: topic, idea and level, normalised. */
export function catalogueKey(topic: string, idea: string, level: string): string {
  return createHash("sha256").update([level, normalise(topic), normalise(idea)].join("\0")).digest("hex");
}

export function notesHash(notes: string): string {
  return createHash("sha256").update(notes.trim()).digest("hex");
}

/** How long a shared lesson is reused before a fresh one is written. */
export function catalogueDays(env: Env): number {
  const n = Number(env.LESSON_CATALOGUE_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/** Waits at most ms for a catalogue call, so a slow database never holds a lesson up. */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        console.error("lesson catalogue:", (e as Error).message);
        resolve(fallback);
      },
    );
  });
}

/** The Neon catalogue, or null when DATABASE_URL is not set or LESSON_CATALOGUE=off. */
export function storeFromEnv(env: Env): LessonStore | null {
  if (!env.DATABASE_URL || env.LESSON_CATALOGUE === "off") return null;
  const sql = neon(env.DATABASE_URL);
  return {
    async find(key, maxAgeDays) {
      const rows = (await sql`
        select id, model, lesson from lessons
        where key = ${key} and shared and retired_at is null
          and created_at > now() - make_interval(days => ${Math.round(maxAgeDays)})
        order by created_at desc limit 1`) as { id: string | number; model: string; lesson: unknown }[];
      const r = rows[0];
      return r ? { id: Number(r.id), model: r.model, lesson: r.lesson } : null;
    },
    async save(row) {
      const usd = row.cost.reduce((s, c) => s + c.usd, 0);
      await sql`
        insert into lessons (key, shared, topic, idea, level, notes_hash, model, lesson, cost_usd, problems)
        values (${row.key}, ${row.shared}, ${row.topic.slice(0, 300)}, ${row.idea.slice(0, 500)}, ${row.level},
                ${row.notesHash}, ${row.model}, ${JSON.stringify(row.lesson)}::jsonb, ${usd},
                ${JSON.stringify(row.problems)}::jsonb)`;
    },
    async served(id) {
      await sql`update lessons set served = served + 1, last_served_at = now() where id = ${id}`;
    },
    async retire(id, reason) {
      await sql`update lessons set retired_at = now(), retired_reason = ${reason} where id = ${id} and retired_at is null`;
    },
  };
}
