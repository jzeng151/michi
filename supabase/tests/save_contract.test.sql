begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_walk_draft(uuid,text,text,text,jsonb,integer,text,jsonb)',
    'execute'
  ),
  'authenticated users can call the draft save contract'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_walk_draft(uuid,text,text,text,jsonb,integer,text,jsonb)',
    'execute'
  ),
  'anonymous users cannot call the draft save contract'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

insert into storage.objects (bucket_id, name) values (
  'walk-media',
  '00000000-0000-4000-8000-000000000002/22000000-0000-4000-8000-000000000001/photo.jpg'
);

select is(
  public.save_walk_draft(
    '22000000-0000-4000-8000-000000000001',
    'Reliable draft',
    'Saved atomically.',
    'Kyoto',
    null,
    0,
    'private',
    jsonb_build_array(
      jsonb_build_object(
        'id', '42000000-0000-4000-8000-000000000001',
        'kind', 'photo',
        'sort_index', 0,
        'lat', 35,
        'lng', 135,
        'captured_at', '2024-04-05T01:02:03Z',
        'note', 'Placed without a mouse.',
        'media_id', '32000000-0000-4000-8000-000000000001',
        'storage_path', '00000000-0000-4000-8000-000000000002/22000000-0000-4000-8000-000000000001/photo.jpg',
        'alt_text', 'A path through Kyoto',
        'original_filename', '京都.jpg',
        'mime_type', 'image/jpeg',
        'orientation', 1
      ),
      jsonb_build_object(
        'id', '42000000-0000-4000-8000-000000000002',
        'kind', 'note',
        'sort_index', 1,
        'note', 'A photo-less stop.'
      )
    )
  ),
  '22000000-0000-4000-8000-000000000001'::uuid,
  'an owner can atomically save media and note stops'
);
select is(
  (select owner_id from public.walks where id = '22000000-0000-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000002'::uuid,
  'the RPC derives ownership from the authenticated user'
);
select is(
  (select count(*) from public.walk_stops where walk_id = '22000000-0000-4000-8000-000000000001'),
  2::bigint,
  'the complete stop snapshot is saved'
);
select is(
  (
    select count(*)
    from public.walk_media m
    join public.walk_stops s on s.id = m.stop_id
    where s.walk_id = '22000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'only the media-backed stop gets a media row'
);
select is(
  (select note from public.walk_stops where id = '42000000-0000-4000-8000-000000000002'),
  'A photo-less stop.',
  'a note-only stop survives the save contract'
);

select is(
  public.save_walk_draft(
    '22000000-0000-4000-8000-000000000001',
    'Reliable draft retry',
    'Saved atomically.',
    'Kyoto',
    null,
    0,
    'private',
    jsonb_build_array(
      jsonb_build_object(
        'id', '42000000-0000-4000-8000-000000000001',
        'kind', 'photo',
        'sort_index', 0,
        'lat', 35,
        'lng', 135,
        'captured_at', '2024-04-05T01:02:03Z',
        'note', 'Placed without a mouse.',
        'media_id', '32000000-0000-4000-8000-000000000001',
        'storage_path', '00000000-0000-4000-8000-000000000002/22000000-0000-4000-8000-000000000001/photo.jpg',
        'alt_text', 'A path through Kyoto',
        'original_filename', '京都.jpg',
        'mime_type', 'image/jpeg',
        'orientation', 1
      ),
      jsonb_build_object(
        'id', '42000000-0000-4000-8000-000000000002',
        'kind', 'note',
        'sort_index', 1,
        'note', 'A photo-less stop.'
      )
    )
  ),
  '22000000-0000-4000-8000-000000000001'::uuid,
  'retrying the same stable IDs succeeds'
);
select is(
  (
    select
      (select count(*) from public.walks where id = '22000000-0000-4000-8000-000000000001')::text
      || '/' ||
      (select count(*) from public.walk_stops where walk_id = '22000000-0000-4000-8000-000000000001')::text
      || '/' ||
      (
        select count(*) from public.walk_media m
        join public.walk_stops s on s.id = m.stop_id
        where s.walk_id = '22000000-0000-4000-8000-000000000001'
      )::text
  ),
  '1/2/1',
  'an idempotent retry creates no duplicate rows'
);
select is(
  (select title from public.walks where id = '22000000-0000-4000-8000-000000000001'),
  'Reliable draft retry',
  'a retry replaces the same draft snapshot'
);

insert into public.walk_stops (
  id, walk_id, kind, sort_index, lat, lng
) values (
  '42000000-0000-4000-8000-000000000003',
  '22000000-0000-4000-8000-000000000001',
  'photo',
  2,
  35,
  135
);
select throws_ok(
  $$
    insert into public.walk_media (id, stop_id, bucket, storage_path)
    values (
      '32000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000003',
      'walk-media',
      '00000000-0000-4000-8000-000000000002/ffffffff-ffff-4fff-8fff-ffffffffffff/wrong.jpg'
    )
  $$,
  '42501',
  null,
  'media RLS binds the second path folder to the stop walk'
);

select throws_ok(
  $$
    select public.save_walk_draft(
      '22000000-0000-4000-8000-000000000002',
      'Missing upload', null, null, null, 0, 'private',
      '[{"id":"42000000-0000-4000-8000-000000000004","kind":"photo","sort_index":0,"media_id":"32000000-0000-4000-8000-000000000004","storage_path":"00000000-0000-4000-8000-000000000002/22000000-0000-4000-8000-000000000002/missing.jpg","mime_type":"image/jpeg"}]'::jsonb
    )
  $$,
  '23503',
  null,
  'the save contract rejects media without an uploaded object'
);
select is(
  (select count(*) from public.walks where id = '22000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a failed save rolls back its walk and stop metadata'
);
select throws_ok(
  $$
    select public.save_walk_draft(
      '22000000-0000-4000-8000-000000000003',
      'Wrong owner folder', null, null, null, 0, 'private',
      '[{"id":"42000000-0000-4000-8000-000000000005","kind":"photo","sort_index":0,"media_id":"32000000-0000-4000-8000-000000000005","storage_path":"00000000-0000-4000-8000-000000000003/22000000-0000-4000-8000-000000000003/photo.jpg","mime_type":"image/jpeg"}]'::jsonb
    )
  $$,
  '23514',
  null,
  'the save contract rejects another user path folder'
);
select throws_ok(
  $$
    select public.save_walk_draft(
      '22000000-0000-4000-8000-000000000004',
      'Wrong draft folder', null, null, null, 0, 'private',
      '[{"id":"42000000-0000-4000-8000-000000000006","kind":"photo","sort_index":0,"media_id":"32000000-0000-4000-8000-000000000006","storage_path":"00000000-0000-4000-8000-000000000002/ffffffff-ffff-4fff-8fff-ffffffffffff/photo.jpg","mime_type":"image/jpeg"}]'::jsonb
    )
  $$,
  '23514',
  null,
  'the save contract rejects another draft path folder'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select throws_ok(
  $$
    select public.save_walk_draft(
      '22000000-0000-4000-8000-000000000001',
      'Cross-owner overwrite', null, null, null, 0, 'private', '[]'::jsonb
    )
  $$,
  '42501',
  null,
  'another user cannot reuse an existing draft ID'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$
    select public.save_walk_draft(
      '22000000-0000-4000-8000-000000000005',
      'Anonymous save', null, null, null, 0, 'private', '[]'::jsonb
    )
  $$,
  '42501',
  null,
  'anonymous callers cannot execute the save contract'
);

select * from finish();

rollback;
