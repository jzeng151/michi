begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select is(
  (
    select string_agg(title, ' | ' order by id)
    from public.walks
    where is_curated
  ),
  'Philosopher''s Path | Nakasendo: Magome to Tsumago | Kumano Kodo: Daimon-zaka to Nachi',
  'a clean seed exposes exactly the three approved curated routes'
);

select is(
  (
    select string_agg(route_id::text || ':' || waypoint_count, ', ' order by route_id)
    from (
      select route_id, count(*)::text as waypoint_count
      from public.curated_waypoints
      group by route_id
    ) counts
  ),
  '10000000-0000-4000-8000-000000000001:10, 10000000-0000-4000-8000-000000000002:10, 10000000-0000-4000-8000-000000000003:10',
  'each approved route has ten waypoint stories'
);

select is(
  (
    select count(*)
    from public.curated_waypoints waypoint
    join public.walk_media media on media.id = waypoint.media_id
    join public.walk_stops stop on
      stop.id = media.stop_id
      and stop.walk_id = waypoint.route_id
      and stop.sort_index = waypoint.sort_index
    where waypoint.title_ja is not null
      and waypoint.media_credit is not null
      and waypoint.media_license is not null
      and waypoint.media_source_url is not null
  ),
  30::bigint,
  'every story is bilingual, photographed, credited, and attached to its route stop'
);

select is(
  (
    select count(*)
    from public.curated_waypoints waypoint
    join public.walk_media media on media.id = waypoint.media_id
    left join storage.objects object on
      object.bucket_id = media.bucket
      and object.name = media.storage_path
    where object.id is null
  ),
  0::bigint,
  'every referenced curated asset resolves in local storage'
);

select is(
  (
    select title || ' · ' || title_ja || ' · ' || media_credit
    from public.match_curated_waypoints(
      '12000000-0000-4000-8000-000000000001'
    )
    where title = 'Tsumago-juku'
    limit 1
  ),
  'Tsumago-juku · 妻籠宿 · 皓月旗',
  'the Nakasendo release fixture returns its bilingual credited Tsumago story'
);

select throws_ok(
  $$
    update public.curated_waypoints
    set media_credit = null
    where id = '51000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  null,
  'a photographed waypoint cannot lose its attribution'
);

select * from finish();

rollback;
