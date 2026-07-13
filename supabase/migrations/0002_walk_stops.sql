-- Make ordered stops the source of truth for media placement and walk drafts.

-- A route exists only when it has at least two placed points. Existing routes
-- remain intact; drafts with fewer points store no route yet.
alter table public.walks drop constraint walks_path_check;
alter table public.walks alter column path drop not null;
alter table public.walks alter column distance_m set default 0;
alter table public.walks add constraint walks_path_check check (
  path is null or (
    path->>'type' = 'LineString'
    and jsonb_array_length(path->'coordinates') between 2 and 5000
    and public.is_lnglat_array(path->'coordinates')
  )
);

create table public.walk_stops (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null references public.walks (id) on delete cascade,
  kind text not null check (kind in ('photo', 'audio', 'note')),
  sort_index integer not null check (sort_index >= 0),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  captured_at timestamptz,
  note text check (note is null or char_length(note) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (walk_id, sort_index),
  check ((lat is null) = (lng is null)),
  check (kind <> 'note' or note is not null)
);

-- Add the new media relationship nullable so existing rows can be migrated.
alter table public.walk_media
  add column stop_id uuid,
  add column original_filename text check (
    original_filename is null or char_length(original_filename) between 1 and 255
  ),
  add column mime_type text check (
    mime_type is null or char_length(mime_type) between 1 and 100
  ),
  add column orientation smallint check (orientation between 1 and 8);

-- Preserve each legacy pin. Ties were previously allowed, so make their order
-- deterministic before adding the per-walk uniqueness constraint.
insert into public.walk_stops (
  id, walk_id, kind, sort_index, lat, lng, note, created_at
)
select
  id,
  walk_id,
  kind,
  row_number() over (
    partition by walk_id order by sort_index, created_at, id
  )::integer - 1,
  lat,
  lng,
  nullif(caption, ''),
  created_at
from public.walk_media;

update public.walk_media set stop_id = id;

-- These policies depend on the legacy walk_id column and must be replaced
-- before the old media placement fields are removed.
drop policy "walk_media_select_visible" on public.walk_media;
drop policy "walk_media_insert_own" on public.walk_media;
drop policy "walk_media_update_own" on public.walk_media;
drop policy "walk_media_delete_own" on public.walk_media;
drop policy "walk_media_storage_select" on storage.objects;

drop index public.walk_media_walk_idx;

alter table public.walk_media
  alter column stop_id set not null,
  add constraint walk_media_stop_id_fkey
    foreign key (stop_id) references public.walk_stops (id) on delete cascade,
  add constraint walk_media_stop_id_key unique (stop_id),
  drop column walk_id,
  drop column kind,
  drop column caption,
  drop column lat,
  drop column lng,
  drop column sort_index;

-- ============================================================ row level security

alter table public.walk_stops enable row level security;

create policy "walk_stops_select_visible" on public.walk_stops
  for select using (public.can_view_walk(walk_id));
create policy "walk_stops_insert_own" on public.walk_stops
  for insert to authenticated
  with check (public.owns_editable_walk(walk_id));
create policy "walk_stops_update_own" on public.walk_stops
  for update to authenticated
  using (public.owns_editable_walk(walk_id))
  with check (public.owns_editable_walk(walk_id));
create policy "walk_stops_delete_own" on public.walk_stops
  for delete to authenticated
  using (public.owns_editable_walk(walk_id));

-- Media authorization follows its stop to the owning walk. Keeping one
-- ownership path prevents stop/media rows from disagreeing about their walk.
create policy "walk_media_select_visible" on public.walk_media
  for select using (
    exists (
      select 1 from public.walk_stops s
      where s.id = stop_id and public.can_view_walk(s.walk_id)
    )
  );
create policy "walk_media_insert_own" on public.walk_media
  for insert to authenticated
  with check (
    exists (
      select 1 from public.walk_stops s
      where s.id = stop_id and public.owns_editable_walk(s.walk_id)
    )
    and bucket = 'walk-media'
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );
create policy "walk_media_update_own" on public.walk_media
  for update to authenticated
  using (
    exists (
      select 1 from public.walk_stops s
      where s.id = stop_id and public.owns_editable_walk(s.walk_id)
    )
  )
  with check (
    exists (
      select 1 from public.walk_stops s
      where s.id = stop_id and public.owns_editable_walk(s.walk_id)
    )
    and bucket = 'walk-media'
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );
create policy "walk_media_delete_own" on public.walk_media
  for delete to authenticated
  using (
    exists (
      select 1 from public.walk_stops s
      where s.id = stop_id and public.owns_editable_walk(s.walk_id)
    )
  );

grant select on public.walk_stops to anon, authenticated;
grant insert, update, delete on public.walk_stops to authenticated;

-- Read own files, or files attached to a stop on a public walk. The owner
-- folder check remains the defense against a poisoned cross-tenant pointer.
create policy "walk_media_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'walk-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.walk_media m
        join public.walk_stops s on s.id = m.stop_id
        join public.walks w on w.id = s.walk_id
        where m.bucket = 'walk-media'
          and m.storage_path = storage.objects.name
          and w.visibility = 'public'
          and (storage.foldername(name))[1] = w.owner_id::text
      )
    )
  );
