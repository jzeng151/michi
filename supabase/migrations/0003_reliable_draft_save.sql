-- Save a complete local draft in one transaction. Blobs are uploaded first;
-- this RPC only commits metadata after every referenced object is present.

-- A user media row must point into both the writer's folder and its walk's
-- folder. The original policy only enforced the first relationship.
drop policy "walk_media_insert_own" on public.walk_media;
create policy "walk_media_insert_own" on public.walk_media
  for insert to authenticated
  with check (
    exists (
      select 1 from public.walk_stops s
      where s.id = stop_id
        and public.owns_editable_walk(s.walk_id)
        and split_part(storage_path, '/', 2) = s.walk_id::text
    )
    and bucket = 'walk-media'
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

drop policy "walk_media_update_own" on public.walk_media;
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
      where s.id = stop_id
        and public.owns_editable_walk(s.walk_id)
        and split_part(storage_path, '/', 2) = s.walk_id::text
    )
    and bucket = 'walk-media'
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

create function public.save_walk_draft(
  p_walk_id uuid,
  p_title text,
  p_description text,
  p_region text,
  p_path jsonb,
  p_distance_m integer,
  p_visibility text,
  p_stops jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  stop record;
begin
  if v_owner_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required.';
  end if;
  if jsonb_typeof(p_stops) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Stops must be a JSON array.';
  end if;

  insert into public.walks (
    id, owner_id, title, description, region, path, distance_m,
    duration_s, visibility
  ) values (
    p_walk_id, v_owner_id, p_title, p_description, p_region, p_path,
    p_distance_m, null, p_visibility
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    region = excluded.region,
    path = excluded.path,
    distance_m = excluded.distance_m,
    duration_s = excluded.duration_s,
    visibility = excluded.visibility
  where walks.owner_id = v_owner_id and not walks.is_curated;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Walk is not editable by this user.';
  end if;

  -- Replacing the snapshot avoids ordering conflicts and makes a retry with
  -- the same client-generated IDs converge on exactly one set of rows.
  delete from public.walk_stops where walk_id = p_walk_id;

  for stop in
    select *
    from jsonb_to_recordset(p_stops) as s(
      id uuid,
      kind text,
      sort_index integer,
      lat double precision,
      lng double precision,
      captured_at timestamptz,
      note text,
      media_id uuid,
      storage_path text,
      alt_text text,
      original_filename text,
      mime_type text,
      orientation smallint
    )
  loop
    if stop.kind = 'note' and (
      stop.media_id is not null
      or stop.storage_path is not null
      or stop.alt_text is not null
      or stop.original_filename is not null
      or stop.mime_type is not null
      or stop.orientation is not null
    ) then
      raise exception using
        errcode = '23514',
        message = 'Note stops cannot include media.';
    end if;
    if stop.kind in ('photo', 'audio') and (
      stop.media_id is null
      or stop.storage_path is null
      or stop.mime_type is null
    ) then
      raise exception using
        errcode = '23514',
        message = 'Media stops require media metadata.';
    end if;
    if stop.media_id is not null and (
      split_part(stop.storage_path, '/', 1) <> v_owner_id::text
      or split_part(stop.storage_path, '/', 2) <> p_walk_id::text
    ) then
      raise exception using
        errcode = '23514',
        message = 'Media path must belong to the user and draft.';
    end if;
    if stop.media_id is not null and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'walk-media' and o.name = stop.storage_path
    ) then
      raise exception using
        errcode = '23503',
        message = 'Uploaded media object does not exist.';
    end if;

    insert into public.walk_stops (
      id, walk_id, kind, sort_index, lat, lng, captured_at, note
    ) values (
      stop.id, p_walk_id, stop.kind, stop.sort_index, stop.lat, stop.lng,
      stop.captured_at, stop.note
    );

    if stop.media_id is not null then
      insert into public.walk_media (
        id, stop_id, bucket, storage_path, alt_text, original_filename,
        mime_type, orientation
      ) values (
        stop.media_id, stop.id, 'walk-media', stop.storage_path, stop.alt_text,
        stop.original_filename, stop.mime_type, stop.orientation
      );
    end if;
  end loop;

  return p_walk_id;
end;
$$;

revoke all on function public.save_walk_draft(
  uuid, text, text, text, jsonb, integer, text, jsonb
) from public, anon;
grant execute on function public.save_walk_draft(
  uuid, text, text, text, jsonb, integer, text, jsonb
) to authenticated;
