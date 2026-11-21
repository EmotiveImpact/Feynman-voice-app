-- Server tables on the Neon "feynman" database (project noisy-sun-77756296).
-- Safe to run again: everything is "if not exists".

-- The lesson catalogue. Every lesson the server writes is saved here.
--   shared = true: a general topic lesson (no notes, nothing the learner said).
--     Reused for anyone asking the same topic, idea and level, until it is
--     older than LESSON_CATALOGUE_DAYS (default 60) or retired.
--   shared = false: built from someone's own notes or words. Kept only so a
--     bad lesson can be looked at later. Never served to anyone else.
--     The notes themselves are not stored, only a fingerprint of them.
create table if not exists lessons (
  id bigserial primary key,
  key text not null,
  shared boolean not null,
  topic text not null,
  idea text not null,
  level text not null,
  notes_hash text,
  model text not null,
  lesson jsonb not null,
  cost_usd numeric(10, 5) not null default 0,
  -- Problems the on-topic check still found (served once, never shared).
  problems jsonb not null default '[]',
  served int not null default 0,
  created_at timestamptz not null default now(),
  last_served_at timestamptz,
  retired_at timestamptz,
  retired_reason text
);

create index if not exists lessons_live_shared on lessons (key, created_at desc)
  where shared and retired_at is null;
create index if not exists lessons_topic on lessons (lower(topic));
