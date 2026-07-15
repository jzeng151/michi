-- Bilingual waypoint titles and media attribution for curated route stories.

alter table public.curated_waypoints
  add column title_ja text check (
    title_ja is null or char_length(title_ja) between 1 and 80
  ),
  add column media_credit text check (
    media_credit is null or char_length(media_credit) between 1 and 160
  ),
  add column media_license text check (
    media_license is null or char_length(media_license) between 1 and 80
  ),
  add column media_source_url text check (
    media_source_url is null or (
      char_length(media_source_url) <= 500
      and media_source_url ~ '^https://'
    )
  );

-- Backfill the two PR 7 fixtures so this remains a forward-only migration.
update public.curated_waypoints set
  title_ja = case title
    when 'The road through the cedars' then '杉木立の古道'
    when 'Tsumago-juku' then '妻籠宿'
  end,
  media_credit = case title
    when 'The road through the cedars' then 'Daderot'
    when 'Tsumago-juku' then '皓月旗'
  end,
  media_license = case title
    when 'The road through the cedars' then 'CC BY-SA 3.0'
    when 'Tsumago-juku' then 'CC BY-SA 4.0'
  end,
  media_source_url = case title
    when 'The road through the cedars' then 'https://commons.wikimedia.org/wiki/File:Nakasendo_between_Tsumago_and_Magome_-_Nov_2005.jpg'
    when 'Tsumago-juku' then 'https://commons.wikimedia.org/wiki/File:Tsumago-juku_6-Jun-2020.jpg'
  end
where title in ('The road through the cedars', 'Tsumago-juku');

alter table public.curated_waypoints add constraint curated_waypoint_media_credit check (
  media_id is null or (
    media_credit is not null
    and media_license is not null
    and media_source_url is not null
  )
);

drop function public.match_curated_waypoints(uuid);

create function public.match_curated_waypoints(p_walk_id uuid)
returns table (
  matched_stop_id uuid,
  waypoint_id uuid,
  route_id uuid,
  route_title text,
  time_period text,
  title text,
  title_ja text,
  story text,
  lat double precision,
  lng double precision,
  sort_index integer,
  distance_m double precision,
  media_id uuid,
  media_bucket text,
  media_path text,
  media_alt text,
  media_mime_type text,
  media_credit text,
  media_license text,
  media_source_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    stop.id,
    waypoint.id,
    waypoint.route_id,
    route.title,
    waypoint.time_period,
    waypoint.title,
    waypoint.title_ja,
    waypoint.story,
    waypoint.lat,
    waypoint.lng,
    waypoint.sort_index,
    waypoint.distance_m,
    case when media_stop.id is not null then media.id end,
    case when media_stop.id is not null then media.bucket end,
    case when media_stop.id is not null then media.storage_path end,
    case when media_stop.id is not null then media.alt_text end,
    case when media_stop.id is not null then media.mime_type end,
    case when media_stop.id is not null then waypoint.media_credit end,
    case when media_stop.id is not null then waypoint.media_license end,
    case when media_stop.id is not null then waypoint.media_source_url end
  from public.walk_stops stop
  cross join lateral (
    select
      candidate.*,
      extensions.st_distance(
        candidate.location,
        extensions.st_setsrid(
          extensions.st_makepoint(stop.lng, stop.lat),
          4326
        )::extensions.geography
      ) as distance_m
    from public.curated_waypoints candidate
    where extensions.st_dwithin(
      candidate.location,
      extensions.st_setsrid(
        extensions.st_makepoint(stop.lng, stop.lat),
        4326
      )::extensions.geography,
      100
    )
    order by
      candidate.location OPERATOR(extensions.<->) extensions.st_setsrid(
        extensions.st_makepoint(stop.lng, stop.lat),
        4326
      )::extensions.geography,
      candidate.route_id,
      candidate.sort_index,
      candidate.id
    limit 100
  ) waypoint
  join public.walks route on
    route.id = waypoint.route_id
    and route.is_curated
    and route.visibility = 'public'
  left join public.walk_media media on
    media.id = waypoint.media_id
    and media.bucket = 'curated'
  left join public.walk_stops media_stop on
    media_stop.id = media.stop_id
    and media_stop.walk_id = waypoint.route_id
  where stop.walk_id = p_walk_id and stop.lat is not null
  order by
    stop.sort_index,
    stop.id,
    distance_m,
    route.title,
    waypoint.sort_index,
    waypoint.id
  limit 100;
$$;

revoke all on function public.match_curated_waypoints(uuid) from public, anon;
grant execute on function public.match_curated_waypoints(uuid) to anon, authenticated;
