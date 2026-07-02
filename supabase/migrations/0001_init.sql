-- Michi initial schema: tables, constraints, RLS, storage policies, trigger, trending view.

-- ============================================================ tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  avatar_url text check (char_length(avatar_url) <= 500),
  bio text check (char_length(bio) <= 300),
  created_at timestamptz not null default now()
);

create table public.walks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  region text check (char_length(region) <= 80),
  path jsonb not null check (
    path->>'type' = 'LineString'
    and jsonb_array_length(path->'coordinates') between 2 and 5000
  ),
  distance_m integer not null check (distance_m >= 0),
  duration_s integer check (duration_s >= 0), -- null for drawn (untimed) walks
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  is_curated boolean not null default false,
  created_at timestamptz not null default now()
);

create index walks_owner_idx on public.walks (owner_id);
create index walks_public_recent_idx on public.walks (visibility, created_at desc);
create index walks_curated_idx on public.walks (is_curated) where is_curated;

create table public.walk_media (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null references public.walks (id) on delete cascade,
  kind text not null check (kind in ('photo', 'audio')),
  bucket text not null default 'walk-media' check (bucket in ('walk-media', 'curated')),
  storage_path text not null check (char_length(storage_path) <= 500),
  alt_text text check (char_length(alt_text) <= 300),
  caption text check (char_length(caption) <= 500),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  sort_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index walk_media_walk_idx on public.walk_media (walk_id, sort_index);
-- storage SELECT policy below looks rows up by path
create index walk_media_path_idx on public.walk_media (storage_path);

create table public.likes (
  walk_id uuid not null references public.walks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (walk_id, user_id)
);

create index likes_recent_idx on public.likes (created_at);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null references public.walks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index comments_walk_idx on public.comments (walk_id, created_at);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ============================================================ profile auto-creation

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
begin
  base := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '_', 'g'));
  base := left(base, 20);
  if base is null or char_length(base) < 3 then
    base := coalesce(base, '') || 'walker';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := left(base, 18) || lpad(floor(random() * 10000)::int::text, 4, '0');
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, left(split_part(new.email, '@', 1), 60));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ policy helpers
-- SECURITY DEFINER so policies on child tables don't recursively evaluate walks RLS.
-- Each helper is the single source of truth for its predicate.

create function public.can_view_walk(w_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.walks w
    where w.id = w_id
      and (w.visibility = 'public' or w.owner_id = (select auth.uid()))
  );
$$;

-- "Editable" excludes curated walks: the demo account owns them, and demo
-- credentials are public, so curated content must be immutable via the API.
create function public.owns_editable_walk(w_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.walks w
    where w.id = w_id and w.owner_id = (select auth.uid()) and not w.is_curated
  );
$$;

create function public.walk_is_public(w_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.walks w where w.id = w_id and w.visibility = 'public'
  );
$$;

-- ============================================================ row level security

alter table public.profiles enable row level security;
alter table public.walks enable row level security;
alter table public.walk_media enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

-- profiles: readable by all; created only by trigger; owner may update
create policy "profiles_select" on public.profiles
  for select using (true);
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- walks
create policy "walks_select_visible" on public.walks
  for select using (visibility = 'public' or owner_id = (select auth.uid()));
create policy "walks_insert_own" on public.walks
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_curated);
create policy "walks_update_own" on public.walks
  for update to authenticated
  using (owner_id = (select auth.uid()) and not is_curated)
  with check (owner_id = (select auth.uid()) and not is_curated);
create policy "walks_delete_own" on public.walks
  for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_curated);

-- walk_media: visible with its walk; writable by the walk's owner.
-- Users may only reference the private bucket; 'curated' rows come from seed only.
create policy "walk_media_select_visible" on public.walk_media
  for select using (public.can_view_walk(walk_id));
create policy "walk_media_insert_own" on public.walk_media
  for insert to authenticated
  with check (public.owns_editable_walk(walk_id) and bucket = 'walk-media');
create policy "walk_media_update_own" on public.walk_media
  for update to authenticated
  using (public.owns_editable_walk(walk_id))
  with check (public.owns_editable_walk(walk_id) and bucket = 'walk-media');
create policy "walk_media_delete_own" on public.walk_media
  for delete to authenticated
  using (public.owns_editable_walk(walk_id));

-- likes: on public walks only; users manage their own
create policy "likes_select_visible" on public.likes
  for select using (public.can_view_walk(walk_id));
create policy "likes_insert_own" on public.likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.walk_is_public(walk_id));
create policy "likes_delete_own" on public.likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- comments: on public walks only; users manage their own
create policy "comments_select_visible" on public.comments
  for select using (public.can_view_walk(walk_id));
create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.walk_is_public(walk_id));
create policy "comments_delete_own" on public.comments
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- follows: public graph; users manage their own edges
create policy "follows_select" on public.follows
  for select using (true);
create policy "follows_insert_own" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "follows_delete_own" on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

-- ============================================================ trending view

create view public.trending_walks
with (security_invoker = true) as
select w.*, count(l.walk_id)::int as recent_likes
from public.walks w
join public.likes l
  on l.walk_id = w.id and l.created_at > now() - interval '7 days'
where w.visibility = 'public'
group by w.id
order by recent_likes desc;

-- ============================================================ privileges
-- Grants define which verbs a role may use; RLS defines which rows they touch.

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.walks, public.walk_media, public.likes,
  public.comments, public.follows, public.trending_walks to anon, authenticated;
-- profiles are created by trigger and never deleted via the API
grant update (username, display_name, avatar_url, bio) on public.profiles to authenticated;
grant insert, update, delete on public.walks, public.walk_media to authenticated;
grant insert, delete on public.likes, public.comments, public.follows to authenticated;

-- ============================================================ storage policies (walk-media bucket)
-- 'curated' is a public bucket with no write policies: world-readable, API-immutable.
-- 'walk-media' paths follow {owner_uid}/{walk_id}/{media_id}.{ext}; folder 1 = owner.

create policy "walk_media_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'walk-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "walk_media_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'walk-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'walk-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "walk_media_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'walk-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Read own files, or any file that a public walk's media row points at.
create policy "walk_media_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'walk-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.walk_media m
        join public.walks w on w.id = m.walk_id
        where m.bucket = 'walk-media'
          and m.storage_path = storage.objects.name
          and w.visibility = 'public'
      )
    )
  );
