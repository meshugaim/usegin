-- v1 schema sketch — Effi 2nd brain on Postgres + pgvector.
-- Intentionally minimal. AGE-promotion-friendly (the edge table maps 1:1
-- onto AGE-labeled edges if/when we graduate).

-- enable pgvector once per database; on Supabase: CREATE EXTENSION vector;

-- ---------------------------------------------------------------------------
-- nodes
-- ---------------------------------------------------------------------------
create type zettel_kind as enum (
  'lesson',
  'idea',
  'decision',
  'frustration',
  'observation',
  'id_ref',
  'question',
  'retro',
  'structure_note',  -- a zettel whose job is to organize other zettels
  'topic',           -- target of `tagged` edges
  'person',          -- target of `authored_by` edges
  'artifact'         -- target of `about_artifact` edges (file, issue, session)
);

create type zettel_origin as enum (
  'chat', 'code', 'retro', 'manual', 'effi_emit'
);

create table zettel (
  id              uuid primary key default gen_random_uuid(),
  kind            zettel_kind not null,
  title           text,                          -- short handle, optional
  body            text not null,                 -- the atomic thought
  body_embedding  vector(1536),                  -- adjust to your embed model
  author          text not null,                 -- 'lihu', 'claude:<sid>', ...
  origin_kind     zettel_origin not null,
  origin_ref      jsonb not null default '{}',   -- session_id, file:line, ENG-XXXX
  created_at      timestamptz not null default now(),
  superseded_by   uuid references zettel(id),    -- denorm of supersedes edge
  retired         boolean not null default false -- never delete; mark
);

create index zettel_kind_idx        on zettel (kind);
create index zettel_created_idx     on zettel (created_at desc);
create index zettel_author_idx      on zettel (author);
create index zettel_origin_ref_gin  on zettel using gin (origin_ref);

-- HNSW for ANN; tune m / ef_construction with real data
create index zettel_embedding_hnsw
  on zettel using hnsw (body_embedding vector_cosine_ops);

-- full-text helper for the keyword leg of hybrid search
create index zettel_body_tsv on zettel
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || body));

-- ---------------------------------------------------------------------------
-- edges
-- ---------------------------------------------------------------------------
create type edge_kind as enum (
  -- explicit, asserted by humans/agents
  'links_to',
  'thread_continues',
  'thread_branches',
  'supersedes',
  'contradicts',
  'tagged',          -- zettel --tagged--> topic zettel
  'authored_by',     -- zettel --authored_by--> person zettel
  'about_artifact',  -- zettel --about--> artifact zettel
  -- derived, asserted by jobs / hooks; cheap to recompute
  'similar_to',
  'co_occurred_with',
  'temporally_near'
);

create table zettel_edge (
  src         uuid not null references zettel(id) on delete cascade,
  dst         uuid not null references zettel(id) on delete cascade,
  kind        edge_kind not null,
  weight      real not null default 1.0,         -- for similar_to etc.
  asserted_by text not null,                     -- 'human:lihu', 'job:nightly_similarity'
  created_at  timestamptz not null default now(),
  evidence    jsonb,                             -- chunk overlap, sim score, session id
  primary key (src, dst, kind)
);

create index zettel_edge_src_kind_idx on zettel_edge (src, kind);
create index zettel_edge_dst_kind_idx on zettel_edge (dst, kind);
create index zettel_edge_kind_idx     on zettel_edge (kind);

-- ---------------------------------------------------------------------------
-- the canonical associative-recall function
--   "pull a wire (a query embedding), find the rope (the activated subgraph)"
-- spreading-activation flavor: hop-decayed, edge-weight-weighted.
-- ---------------------------------------------------------------------------
create or replace function recall(
  query_embedding vector(1536),
  max_hops        int  default 3,
  hop_decay       real default 0.6,
  seed_k          int  default 10,
  result_limit    int  default 25
)
returns table (
  id uuid,
  kind zettel_kind,
  title text,
  body text,
  activation real
)
language sql stable as $$
  with recursive
    seeds as (
      select id, 0 as hop, 1.0::real as edge_weight
      from zettel
      where not retired
      order by body_embedding <=> query_embedding
      limit seed_k
    ),
    walk as (
      select id, hop, edge_weight from seeds
      union
      select e.dst, w.hop + 1,
             w.edge_weight * e.weight * hop_decay
      from walk w
      join zettel_edge e on e.src = w.id
      where w.hop < max_hops
    )
  select z.id, z.kind, z.title, z.body, max(walk.edge_weight) as activation
  from walk
  join zettel z on z.id = walk.id
  where not z.retired
  group by z.id, z.kind, z.title, z.body
  order by activation desc
  limit result_limit;
$$;

-- ---------------------------------------------------------------------------
-- nightly job (sketch): refresh similar_to edges
--   for each zettel, write the top-K most-similar non-self edges.
--   asserted_by makes the provenance explicit so we can later evolve the rule.
-- ---------------------------------------------------------------------------
-- delete from zettel_edge where kind = 'similar_to' and asserted_by = 'job:nightly_similarity';
-- insert into zettel_edge (src, dst, kind, weight, asserted_by, evidence)
-- select src.id, dst.id, 'similar_to'::edge_kind,
--        1 - (src.body_embedding <=> dst.body_embedding) as weight,
--        'job:nightly_similarity',
--        jsonb_build_object('cosine_distance', src.body_embedding <=> dst.body_embedding)
-- from zettel src
-- cross join lateral (
--   select id, body_embedding
--   from zettel
--   where id <> src.id and not retired
--   order by src.body_embedding <=> body_embedding
--   limit 8
-- ) dst
-- where not src.retired;
