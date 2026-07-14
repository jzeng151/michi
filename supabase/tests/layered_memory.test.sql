begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into public.walks (
  id, owner_id, title, path, distance_m, visibility, is_curated
) values
  (
    '24000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Boundary route',
    '{"type":"LineString","coordinates":[[0,0],[0.001,0.001]]}',
    150,
    'public',
    true
  ),
  (
    '24000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'Cap route',
    '{"type":"LineString","coordinates":[[10,10],[10.001,10.001]]}',
    150,
    'public',
    true
  ),
  (
    '24000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000002',
    'Private boundary walk',
    null,
    0,
    'private',
    false
  ),
  (
    '24000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000002',
    'Private capped walk',
    null,
    0,
    'private',
    false
  );

insert into public.curated_waypoints (
  id, route_id, lat, lng, time_period, title, story, sort_index
) values (
  '54000000-0000-4000-8000-000000000001',
  '24000000-0000-4000-8000-000000000001',
  0,
  0,
  'Test period',
  'Boundary story',
  'A waypoint used to prove the inclusive radius.',
  0
);

insert into public.curated_waypoints (
  route_id, lat, lng, time_period, title, story, sort_index
)
select
  '24000000-0000-4000-8000-000000000002',
  10,
  10,
  'Test period',
  'Capped story ' || n,
  'A waypoint used to prove the hard result cap.',
  n
from generate_series(0, 104) as n;

with projected as (
  select
    extensions.st_project(
      extensions.st_setsrid(extensions.st_makepoint(0, 0), 4326)::extensions.geography,
      metres,
      radians(90)
    )::extensions.geometry as point,
    metres,
    sort_index,
    id
  from (values
    (100::double precision, 0, '44000000-0000-4000-8000-000000000001'::uuid),
    (50::double precision, 1, '44000000-0000-4000-8000-000000000002'::uuid),
    (101::double precision, 2, '44000000-0000-4000-8000-000000000003'::uuid)
  ) as distances(metres, sort_index, id)
)
insert into public.walk_stops (id, walk_id, kind, sort_index, lat, lng)
select
  id,
  '24000000-0000-4000-8000-000000000003',
  'photo',
  sort_index,
  extensions.st_y(point),
  extensions.st_x(point)
from projected;

insert into public.walk_stops (
  id, walk_id, kind, sort_index, lat, lng
) values (
  '44000000-0000-4000-8000-000000000004',
  '24000000-0000-4000-8000-000000000004',
  'photo',
  0,
  10,
  10
);

select ok(
  exists (
    select 1 from pg_extension
    where extname = 'postgis' and extnamespace = 'extensions'::regnamespace
  ),
  'PostGIS is installed in the extensions schema'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'curated_waypoints_location_idx'
      and indexdef like '%USING gist (location)%'
  ),
  'the proximity predicate has a GiST index'
);
select ok(
  position(
    'st_dwithin' in lower(
      pg_get_functiondef('public.match_curated_waypoints(uuid)'::regprocedure)
    )
  ) > 0
    and position(
      '<->' in pg_get_functiondef(
        'public.match_curated_waypoints(uuid)'::regprocedure
      )
    ) > 0,
  'the authoritative query uses indexed radius and nearest-neighbour predicates'
);
select ok(
  position(
    'limit 100' in lower(
      pg_get_functiondef('public.match_curated_waypoints(uuid)'::regprocedure)
    )
  ) > 0,
  'the authoritative query has a hard result cap'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (
    select count(*) from public.match_curated_waypoints(
      '24000000-0000-4000-8000-000000000003'
    ) where matched_stop_id = '44000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'a stop exactly 100 metres away matches'
);
select is(
  (
    select count(*) from public.match_curated_waypoints(
      '24000000-0000-4000-8000-000000000003'
    ) where matched_stop_id = '44000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'a stop 101 metres away does not match'
);
select is(
  (
    select count(*) from public.match_curated_waypoints(
      '24000000-0000-4000-8000-000000000003'
    ) where waypoint_id = '54000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'multiple user stops may match the same waypoint'
);
select is(
  (
    select count(*) from public.match_curated_waypoints(
      '24000000-0000-4000-8000-000000000004'
    )
  ),
  100::bigint,
  'the proximity query never returns more than 100 rows'
);
select is(
  (
    select min(sort_index)::text || ':' || max(sort_index)::text
    from public.match_curated_waypoints(
      '24000000-0000-4000-8000-000000000004'
    )
  ),
  '0:99',
  'capped ties resolve by deterministic waypoint order'
);
select throws_ok(
  $$
    insert into public.curated_waypoints (
      route_id, lat, lng, time_period, title, story, sort_index
    ) values (
      '24000000-0000-4000-8000-000000000001',
      0,
      0,
      'Now',
      'Client story',
      'Clients cannot create curated stories.',
      99
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot write curated waypoints'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select is(
  (
    select count(*) from public.match_curated_waypoints(
      '24000000-0000-4000-8000-000000000003'
    )
  ),
  0::bigint,
  'another user cannot match a private walk'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (
    select count(*) from public.curated_waypoints
    where id = '54000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'public curated waypoint reads work'
);
select is(
  (
    select count(*) from public.match_curated_waypoints(
      '24000000-0000-4000-8000-000000000003'
    )
  ),
  0::bigint,
  'anonymous matching cannot leak private user stops'
);
select ok(
  not has_table_privilege('anon', 'public.curated_waypoints', 'INSERT')
    and not has_table_privilege('authenticated', 'public.curated_waypoints', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.curated_waypoints', 'DELETE'),
  'client roles have no curated waypoint write privileges'
);

select * from finish();

rollback;
