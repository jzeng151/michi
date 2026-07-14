-- Public, immutable waypoint stories matched to visible user stops by distance.

create extension if not exists postgis with schema extensions;

create table public.curated_waypoints (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.walks (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  ) stored,
  time_period text not null check (char_length(time_period) between 1 and 120),
  title text not null check (char_length(title) between 1 and 160),
  story text not null check (char_length(story) between 1 and 2000),
  media_id uuid references public.walk_media (id) on delete set null,
  sort_index integer not null check (sort_index >= 0),
  created_at timestamptz not null default now(),
  unique (route_id, sort_index)
);

create index curated_waypoints_location_idx
  on public.curated_waypoints using gist (location);

alter table public.curated_waypoints enable row level security;

create policy "curated_waypoints_select" on public.curated_waypoints
  for select using (true);

grant select on public.curated_waypoints to anon, authenticated;

create function public.match_curated_waypoints(p_walk_id uuid)
returns table (
  matched_stop_id uuid,
  waypoint_id uuid,
  route_id uuid,
  route_title text,
  time_period text,
  title text,
  story text,
  lat double precision,
  lng double precision,
  sort_index integer,
  distance_m double precision,
  media_id uuid,
  media_bucket text,
  media_path text,
  media_alt text,
  media_mime_type text
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
    waypoint.story,
    waypoint.lat,
    waypoint.lng,
    waypoint.sort_index,
    waypoint.distance_m,
    case when media_stop.id is not null then media.id end,
    case when media_stop.id is not null then media.bucket end,
    case when media_stop.id is not null then media.storage_path end,
    case when media_stop.id is not null then media.alt_text end,
    case when media_stop.id is not null then media.mime_type end
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
