-- Michi seed: demo users, curated walks, media pins, likes/comments for trending.
-- Runs as postgres (bypasses RLS); CHECK constraints still apply.
-- GeoJSON coordinates are [lng, lat].

-- ============================================================ demo users
-- Login: michi@seed.local / michi-demo-password (and same password for the others).
-- The on_auth_user_created trigger creates each profile row.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'michi@seed.local'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'aiko@seed.local'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'kenji@seed.local'),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'yuki@seed.local')
    ) as t(uid, addr)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.uid, 'authenticated', 'authenticated',
      u.addr, extensions.crypt('michi-demo-password', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.uid, u.uid::text,
      jsonb_build_object('sub', u.uid::text, 'email', u.addr, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end;
$$;

update public.profiles set display_name = 'Michi', bio = 'Curated walks from the Michi team. 道を歩こう。'
  where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set display_name = 'Aiko', bio = 'Kyoto mornings, film camera in hand.'
  where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set display_name = 'Kenji', bio = 'Long trails, short naps.'
  where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set display_name = 'Yuki', bio = 'Chasing seasons across Japan.'
  where id = '00000000-0000-4000-8000-000000000004';

-- ============================================================ curated walks

insert into public.walks (id, owner_id, title, description, region, path, distance_m, visibility, is_curated) values
(
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Philosopher''s Path',
  'Follow the canal from Ginkaku-ji toward Nanzen-ji beneath hundreds of cherry trees. Quiet in the early morning; stop for the small shrines and sleeping cats along the stone path.',
  'Kyoto',
  '{"type":"LineString","coordinates":[[135.7942,35.0268],[135.7946,35.0254],[135.7944,35.0240],[135.7947,35.0227],[135.7945,35.0213],[135.7948,35.0199],[135.7946,35.0186],[135.7949,35.0172],[135.7947,35.0158],[135.7950,35.0145],[135.7948,35.0132],[135.7951,35.0122],[135.7947,35.0115],[135.7943,35.0111]]}',
  1800, 'public', true
),
(
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Nakasendo: Magome to Tsumago',
  'The most walkable stretch of the old Edo post road: stone paving, cedar forest, two beautifully preserved post towns, and a tea house at the pass that still serves walkers for free.',
  'Kiso Valley, Nagano',
  '{"type":"LineString","coordinates":[[137.5695,35.5266],[137.5713,35.5299],[137.5731,35.5330],[137.5752,35.5362],[137.5770,35.5392],[137.5789,35.5424],[137.5808,35.5455],[137.5826,35.5487],[137.5845,35.5518],[137.5863,35.5549],[137.5880,35.5580],[137.5896,35.5622],[137.5912,35.5664],[137.5926,35.5706],[137.5938,35.5745],[137.5945,35.5774]]}',
  7900, 'public', true
),
(
  '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  'Kamakura Coastal Stroll',
  'From Hase station down to Yuigahama beach, then west along the sea wall to the Inamuragasaki headland for sunset over Sagami Bay — Enoshima and, on clear days, Mt. Fuji on the horizon.',
  'Kamakura, Kanagawa',
  '{"type":"LineString","coordinates":[[139.5330,35.3123],[139.5332,35.3108],[139.5330,35.3095],[139.5316,35.3089],[139.5301,35.3084],[139.5286,35.3078],[139.5271,35.3072],[139.5257,35.3066],[139.5244,35.3058],[139.5234,35.3049],[139.5227,35.3040]]}',
  1700, 'public', true
),
(
  '10000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',
  'Shibuya Night Loop',
  'Cross the scramble with the crowd, drift up Center-gai into the backstreets, loop along Koen-dori and come back past Miyashita Park as the neon takes over. Best after dark.',
  'Tokyo',
  '{"type":"LineString","coordinates":[[139.7006,35.6591],[139.6994,35.6595],[139.6983,35.6600],[139.6980,35.6610],[139.6982,35.6620],[139.6987,35.6628],[139.6993,35.6633],[139.7001,35.6631],[139.7008,35.6627],[139.7016,35.6619],[139.7023,35.6610],[139.7018,35.6601],[139.7013,35.6595],[139.7006,35.6591]]}',
  1600, 'public', true
),
(
  '10000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000001',
  'Fushimi Inari Lower Loop',
  'Through the great torii and up into the first tunnels of vermilion gates, out to Okusha shrine and back down the quiet side path past mossy fox statues. Go at dawn to have the gates to yourself.',
  'Kyoto',
  '{"type":"LineString","coordinates":[[135.7727,34.9671],[135.7738,34.9673],[135.7746,34.9676],[135.7756,34.9679],[135.7765,34.9683],[135.7773,34.9680],[135.7782,34.9689],[135.7789,34.9680],[135.7780,34.9671],[135.7765,34.9666],[135.7750,34.9665],[135.7737,34.9668],[135.7727,34.9671]]}',
  1800, 'public', true
);

-- ============================================================ media stops (seed art in public 'curated' bucket)

insert into public.walk_stops (id, walk_id, kind, sort_index, lat, lng, note) values
('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'photo', 0, 35.0254, 135.7946,
 'The canal in full bloom near Ginkaku-ji'),
('11000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'photo', 1, 35.0186, 135.7946,
 'Canal-side path and bridge near Ginkaku-ji'),
('11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'photo', 0, 35.5455, 137.5808,
 'On the old road between Magome and Tsumago'),
('11000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'photo', 1, 35.5745, 137.5938,
 'Tsumago, lovingly preserved'),
('11000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'photo', 0, 35.3084, 139.5301,
 'Yuigahama, looking along the Kamakura coast'),
('11000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'photo', 1, 35.3040, 139.5227,
 'The coastal view from Inamuragasaki'),
('11000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000004', 'photo', 0, 35.6591, 139.7006,
 'The scramble after dark'),
('11000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'photo', 1, 35.6628, 139.6987,
 'Center-gai after dark'),
('11000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000005', 'photo', 0, 34.9679, 135.7756,
 'Senbon torii, just after dawn'),
('11000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000005', 'photo', 1, 34.9680, 135.7773,
 'Okusha Hohaisho at Fushimi Inari');

insert into public.walk_media (
  stop_id, bucket, storage_path, alt_text, original_filename, mime_type, orientation
) values
('11000000-0000-4000-8000-000000000001', 'curated', 'sakura-canal.webp',
 'Cherry blossoms arching over a narrow stone canal', 'sakura-canal.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000002', 'curated', 'stone-bridge.webp',
 'A small stone bridge beside the tree-lined Philosopher''s Path canal', 'stone-bridge.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000003', 'curated', 'cedar-trail.webp',
 'A Nakasendo trail sign beneath autumn maple trees between Magome and Tsumago', 'cedar-trail.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000004', 'curated', 'post-town.webp',
 'Wooden Edo-period houses lining a sloped village street', 'post-town.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000005', 'curated', 'coastal-wave.webp',
 'A wide sandy beach and calm sea beneath a pale sky at Yuigahama', 'coastal-wave.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000006', 'curated', 'sunset-cape.webp',
 'Enoshima and Mount Fuji seen across the coast from Inamuragasaki', 'sunset-cape.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000007', 'curated', 'neon-crossing.webp',
 'Shibuya Scramble Crossing beneath illuminated signs at night', 'neon-crossing.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000008', 'curated', 'lantern-alley.webp',
 'Shibuya Center-gai lit by storefront signs after dark', 'lantern-alley.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000009', 'curated', 'vermilion-gates.webp',
 'A tunnel of closely spaced vermilion torii gates', 'vermilion-gates.webp', 'image/webp', 1),
('11000000-0000-4000-8000-000000000010', 'curated', 'fox-shrine.webp',
 'The red and white Okusha Hohaisho shrine beneath dense trees', 'fox-shrine.webp', 'image/webp', 1);

-- ============================================================ likes (recent, so Trending has data)

insert into public.likes (walk_id, user_id, created_at) values
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', now() - interval '1 day'),
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', now() - interval '2 days'),
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', now() - interval '3 days'),
('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', now() - interval '1 day'),
('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', now() - interval '4 days'),
('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', now() - interval '2 days'),
('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', now() - interval '6 days'),
('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', now() - interval '5 days'),
('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', now() - interval '30 days');

-- ============================================================ comments

insert into public.comments (walk_id, user_id, body, created_at) values
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
 'Walked this at 6am in April — petals on the water the whole way. Unforgettable.', now() - interval '1 day'),
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003',
 'The coffee stand near the southern end is worth the detour.', now() - interval '20 hours'),
('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
 'Did this in autumn rain and it was still magical. Bring proper shoes for the stone sections.', now() - interval '3 days'),
('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
 'Caught Fuji at sunset from the cape. Timing the tide makes the beach section nicer.', now() - interval '4 days'),
('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002',
 'The playback on this one feels like a music video. Neon everywhere.', now() - interval '1 day'),
('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004',
 'Dawn is the move — had the gates completely empty until the second fork.', now() - interval '2 days');
