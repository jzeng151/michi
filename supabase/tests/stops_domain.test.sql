begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

insert into public.walks (id, owner_id, title, visibility) values
  (
    '21000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Empty draft',
    'private'
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'One-stop draft',
    'private'
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000002',
    'Public multi-stop draft',
    'public'
  );

insert into public.walk_stops (
  id, walk_id, kind, sort_index, lat, lng, captured_at, note
) values
  (
    '41000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000002',
    'photo',
    0,
    null,
    null,
    '2024-04-05 01:02:03+00',
    null
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000003',
    'note',
    0,
    null,
    null,
    null,
    'Reached the old bridge.'
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    '21000000-0000-4000-8000-000000000003',
    'photo',
    1,
    35,
    135,
    '2024-04-05 02:00:00+00',
    'First placed photo.'
  ),
  (
    '41000000-0000-4000-8000-000000000004',
    '21000000-0000-4000-8000-000000000003',
    'photo',
    2,
    35.001,
    135.001,
    '2024-04-05 03:00:00+00',
    null
  );

insert into public.walk_media (
  id, stop_id, bucket, storage_path, alt_text,
  original_filename, mime_type, orientation
) values
  (
    '31000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'walk-media',
    '00000000-0000-4000-8000-000000000002/21000000-0000-4000-8000-000000000002/unplaced.jpg',
    'An unplaced test photo',
    'unplaced.jpg',
    'image/jpeg',
    1
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    'walk-media',
    '00000000-0000-4000-8000-000000000002/21000000-0000-4000-8000-000000000003/placed.jpg',
    'A placed test photo',
    '旅行.jpg',
    'image/jpeg',
    6
  );

select is(
  (select count(*) from public.walk_stops where walk_id = '21000000-0000-4000-8000-000000000001'),
  0::bigint,
  'a zero-stop draft is valid'
);
select is(
  (select count(*) from public.walk_stops where walk_id = '21000000-0000-4000-8000-000000000002'),
  1::bigint,
  'a one-stop draft is valid'
);
select is(
  (select count(*) from public.walk_stops where walk_id = '21000000-0000-4000-8000-000000000003'),
  3::bigint,
  'multiple ordered stops are valid'
);
select is(
  (select count(*) from public.walks where id::text like '21000000-%' and path is null),
  3::bigint,
  'drafts do not require stored route geometry'
);
select is(
  (select count(*) from public.walk_media where stop_id = '41000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a note stop needs no media object'
);
select ok(
  (select lat is null and lng is null from public.walk_stops where id = '41000000-0000-4000-8000-000000000001'),
  'an unplaced photo needs no coordinates'
);
select is(
  (select captured_at from public.walk_stops where id = '41000000-0000-4000-8000-000000000001'),
  '2024-04-05 01:02:03+00'::timestamptz,
  'capture time is retained on the stop'
);
select is(
  (
    select original_filename || '|' || mime_type || '|' || orientation
    from public.walk_media where id = '31000000-0000-4000-8000-000000000002'
  ),
  '旅行.jpg|image/jpeg|6',
  'media retains filename, MIME type, and orientation'
);

select throws_ok(
  $$
    insert into public.walk_media (stop_id, bucket, storage_path)
    values ('41000000-0000-4000-8000-000000000003', 'curated', 'duplicate.webp')
  $$,
  '23505',
  null,
  'a stop has at most one media row'
);
select throws_ok(
  $$
    insert into public.walk_media (stop_id, bucket, storage_path, orientation)
    values ('41000000-0000-4000-8000-000000000002', 'curated', 'bad.webp', 9)
  $$,
  '23514',
  null,
  'orientation must be an EXIF value from one through eight'
);
select throws_ok(
  $$
    insert into public.walk_media (stop_id, bucket, storage_path)
    values ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'curated', 'missing.webp')
  $$,
  '23503',
  null,
  'media must belong to an existing stop'
);
select throws_ok(
  $$
    insert into public.walk_stops (walk_id, kind, sort_index)
    values ('21000000-0000-4000-8000-000000000001', 'video', 0)
  $$,
  '23514',
  null,
  'stop kind is constrained'
);
select throws_ok(
  $$
    insert into public.walk_stops (walk_id, kind, sort_index)
    values ('21000000-0000-4000-8000-000000000001', 'photo', -1)
  $$,
  '23514',
  null,
  'stop order cannot be negative'
);
select throws_ok(
  $$
    insert into public.walk_stops (walk_id, kind, sort_index)
    values ('21000000-0000-4000-8000-000000000002', 'photo', 0)
  $$,
  '23505',
  null,
  'stop order is unique within a walk'
);
select throws_ok(
  $$
    insert into public.walk_stops (walk_id, kind, sort_index, lat)
    values ('21000000-0000-4000-8000-000000000001', 'photo', 0, 35)
  $$,
  '23514',
  null,
  'coordinates are both present or both absent'
);
select throws_ok(
  $$
    insert into public.walk_stops (walk_id, kind, sort_index, lat, lng)
    values ('21000000-0000-4000-8000-000000000001', 'photo', 0, 91, 135)
  $$,
  '23514',
  null,
  'coordinates stay in geographic range'
);
select throws_ok(
  $$
    insert into public.walk_stops (walk_id, kind, sort_index, note)
    values ('21000000-0000-4000-8000-000000000001', 'note', 0, '')
  $$,
  '23514',
  null,
  'a note stop needs content'
);

select is(
  (
    select string_agg(title || ':' || stop_count, ', ' order by id)
    from (
      select w.id, w.title, count(s.id)::text as stop_count
      from public.walks w
      join public.walk_stops s on s.walk_id = w.id
      where w.is_curated
      group by w.id, w.title
    ) seeded
  ),
  'Philosopher''s Path:10, Nakasendo: Magome to Tsumago:10, Kumano Kodo: Daimon-zaka to Nachi:10',
  'the three seeded routes each expose ten ordered photo stops'
);
select is(
  (
    select count(*)
    from public.walk_stops s
    join public.walks w on w.id = s.walk_id and w.is_curated
    left join public.walk_media m on m.stop_id = s.id
    where m.id is null
  ),
  0::bigint,
  'every seeded photo stop remains related to media'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.walk_stops where id = '41000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an owner can read a private stop'
);
select is(
  (select count(*) from public.walk_media where id = '31000000-0000-4000-8000-000000000001'),
  1::bigint,
  'an owner can read private stop media'
);
select lives_ok(
  $$
    insert into public.walk_stops (id, walk_id, kind, sort_index)
    values (
      '41000000-0000-4000-8000-000000000010',
      '21000000-0000-4000-8000-000000000002',
      'photo',
      1
    )
  $$,
  'an owner can insert a stop'
);
select lives_ok(
  $$
    update public.walk_stops set note = 'Updated by owner.'
    where id = '41000000-0000-4000-8000-000000000010'
  $$,
  'an owner can update a stop'
);
select lives_ok(
  $$
    insert into public.walk_media (id, stop_id, bucket, storage_path)
    values (
      '31000000-0000-4000-8000-000000000010',
      '41000000-0000-4000-8000-000000000010',
      'walk-media',
      '00000000-0000-4000-8000-000000000002/21000000-0000-4000-8000-000000000002/owner.jpg'
    )
  $$,
  'an owner can attach media to their stop'
);
select lives_ok(
  $$delete from public.walk_stops where id = '41000000-0000-4000-8000-000000000010'$$,
  'an owner can delete a stop'
);
select is(
  (select count(*) from public.walk_media where id = '31000000-0000-4000-8000-000000000010'),
  0::bigint,
  'deleting a stop removes its media relationship'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.walk_stops where id = '41000000-0000-4000-8000-000000000001'),
  0::bigint,
  'another user cannot read a private stop'
);
select is(
  (select count(*) from public.walk_media where id = '31000000-0000-4000-8000-000000000001'),
  0::bigint,
  'another user cannot read private stop media'
);
select is(
  (select count(*) from public.walk_stops where walk_id = '21000000-0000-4000-8000-000000000003'),
  3::bigint,
  'another user can read public stops'
);
select is(
  (select count(*) from public.walk_media where id = '31000000-0000-4000-8000-000000000002'),
  1::bigint,
  'another user can read public stop media'
);
select throws_ok(
  $$
    insert into public.walk_stops (walk_id, kind, sort_index)
    values ('21000000-0000-4000-8000-000000000001', 'photo', 0)
  $$,
  '42501',
  null,
  'another user cannot add a stop to a private walk'
);
update public.walk_stops set note = 'Cross-owner edit.'
where id = '41000000-0000-4000-8000-000000000003';
select is(
  (select note from public.walk_stops where id = '41000000-0000-4000-8000-000000000003'),
  'First placed photo.',
  'another user cannot update a public stop'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.walk_stops where walk_id = '21000000-0000-4000-8000-000000000003'),
  3::bigint,
  'anonymous users can read public stops'
);
select is(
  (select count(*) from public.walk_media where id = '31000000-0000-4000-8000-000000000002'),
  1::bigint,
  'anonymous users can read public stop media'
);
select is(
  (select count(*) from public.walk_stops where id = '41000000-0000-4000-8000-000000000001'),
  0::bigint,
  'anonymous users cannot read private stops'
);
select is(
  (select count(*) from public.walk_media where id = '31000000-0000-4000-8000-000000000001'),
  0::bigint,
  'anonymous users cannot read private stop media'
);

select * from finish();

rollback;
