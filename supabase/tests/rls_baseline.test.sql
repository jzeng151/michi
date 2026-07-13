begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select is(
  (select public from storage.buckets where id = 'curated'),
  true,
  'curated storage is public'
);
select is(
  (select public from storage.buckets where id = 'walk-media'),
  false,
  'walk media storage is private'
);

insert into public.walks (
  id, owner_id, title, path, distance_m, visibility
) values
  (
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Private RLS walk',
    '{"type":"LineString","coordinates":[[135,35],[135.001,35.001]]}',
    150,
    'private'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'Public RLS walk',
    '{"type":"LineString","coordinates":[[135,35],[135.001,35.001]]}',
    150,
    'public'
  );

insert into public.walk_media (
  id, walk_id, kind, bucket, storage_path, lat, lng
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'photo',
    'walk-media',
    '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/private.jpg',
    35,
    135
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'photo',
    'walk-media',
    '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/public.jpg',
    35,
    135
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'photo',
    'walk-media',
    '00000000-0000-4000-8000-000000000004/poisoned.jpg',
    35,
    135
  );

insert into storage.objects (bucket_id, name) values
  (
    'walk-media',
    '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/private.jpg'
  ),
  (
    'walk-media',
    '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/public.jpg'
  ),
  (
    'walk-media',
    '00000000-0000-4000-8000-000000000004/poisoned.jpg'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  public.can_view_walk('20000000-0000-4000-8000-000000000001'),
  true,
  'owner view helper accepts a private walk'
);
select is(
  public.owns_editable_walk('20000000-0000-4000-8000-000000000001'),
  true,
  'owner edit helper accepts a non-curated walk'
);
select is(
  public.walk_is_public('20000000-0000-4000-8000-000000000002'),
  true,
  'public helper accepts a public walk'
);

select is(
  (select count(*) from public.walks where id = '20000000-0000-4000-8000-000000000001'),
  1::bigint,
  'owner can read a private walk'
);
select is(
  (select count(*) from public.walk_media where id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'owner can read private walk media'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'walk-media'
    and name = '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/private.jpg'),
  1::bigint,
  'owner can read their private storage object'
);
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values (
      'walk-media',
      '00000000-0000-4000-8000-000000000002/uploads/allowed.jpg'
    )
  $$,
  'owner can write inside their storage folder'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values (
      'walk-media',
      '00000000-0000-4000-8000-000000000003/uploads/denied.jpg'
    )
  $$,
  '42501',
  null,
  'owner cannot write inside another user storage folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('curated', 'client-write.jpg')$$,
  '42501',
  null,
  'clients cannot write curated storage'
);
select throws_ok(
  $$
    insert into public.walk_media (walk_id, kind, bucket, storage_path, lat, lng)
    values (
      '20000000-0000-4000-8000-000000000001',
      'photo',
      'walk-media',
      '00000000-0000-4000-8000-000000000003/foreign.jpg',
      35,
      135
    )
  $$,
  '42501',
  null,
  'owner cannot register media from another user storage folder'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);

select is(
  public.can_view_walk('20000000-0000-4000-8000-000000000001'),
  false,
  'view helper rejects another user private walk'
);
select is(
  public.owns_editable_walk('20000000-0000-4000-8000-000000000002'),
  false,
  'edit helper rejects another user public walk'
);

select is(
  (select count(*) from public.walks where id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'another user cannot read a private walk'
);
select is(
  (select count(*) from public.walk_media where id = '30000000-0000-4000-8000-000000000001'),
  0::bigint,
  'another user cannot read private walk media'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'walk-media'
    and name = '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/private.jpg'),
  0::bigint,
  'another user cannot read a private storage object'
);
select is(
  (select count(*) from public.walks where id = '20000000-0000-4000-8000-000000000002'),
  1::bigint,
  'another user can read a public walk'
);
select is(
  (select count(*) from public.walk_media where id = '30000000-0000-4000-8000-000000000002'),
  1::bigint,
  'another user can read public walk media'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'walk-media'
    and name = '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/public.jpg'),
  1::bigint,
  'another authenticated user can read storage referenced by a public walk'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'walk-media'
    and name = '00000000-0000-4000-8000-000000000004/poisoned.jpg'),
  0::bigint,
  'a public media pointer cannot expose another owner storage object'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.walks where id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'anonymous users can read a curated public walk'
);
select is(
  (select count(*) from public.walk_media where storage_path = 'sakura-canal.webp'),
  1::bigint,
  'anonymous users can read curated public media'
);
select is(
  (select count(*) from public.walks where id = '20000000-0000-4000-8000-000000000002'),
  1::bigint,
  'anonymous users can read a non-curated public walk'
);
select is(
  (select count(*) from public.walk_media where id = '30000000-0000-4000-8000-000000000002'),
  1::bigint,
  'anonymous users can read non-curated public media'
);
select is(
  (select count(*) from public.walks where id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'anonymous users cannot read a private walk'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'walk-media'
    and name = '00000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/public.jpg'),
  0::bigint,
  'anonymous users cannot query the private media bucket'
);

select * from finish();

rollback;
