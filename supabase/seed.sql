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
  '哲学の道 (Tetsugaku no Michi) follows the Lake Biwa Canal from Ginkaku-ji toward Nanzen-ji, linking a contemplative modern path with centuries of temple history.',
  'Kyoto · 京都',
  '{"type":"LineString","coordinates":[[135.7942,35.0268],[135.7946,35.0254],[135.7944,35.0240],[135.7947,35.0227],[135.7945,35.0213],[135.7948,35.0199],[135.7946,35.0186],[135.7949,35.0172],[135.7947,35.0158],[135.7950,35.0145],[135.7948,35.0132],[135.7951,35.0122],[135.7947,35.0115],[135.7943,35.0111]]}',
  1800, 'public', true
),
(
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Nakasendo: Magome to Tsumago',
  '中山道 crosses the Kiso Valley between the post towns of Magome and Tsumago: stone paving, cedar forest, travelers'' guardians, waterfalls, and an Edo-period rest house.',
  'Kiso Valley · 木曽路',
  '{"type":"LineString","coordinates":[[137.5695,35.5266],[137.5713,35.5299],[137.5731,35.5330],[137.5752,35.5362],[137.5770,35.5392],[137.5789,35.5424],[137.5808,35.5455],[137.5826,35.5487],[137.5845,35.5518],[137.5863,35.5549],[137.5880,35.5580],[137.5896,35.5622],[137.5912,35.5664],[137.5926,35.5706],[137.5938,35.5745],[137.5945,35.5774]]}',
  7900, 'public', true
),
(
  '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  'Kumano Kodo: Daimon-zaka to Nachi',
  '熊野古道 climbs the cedar-lined Daimon-zaka pilgrimage path to Kumano Nachi Taisha, Seiganto-ji, and the sacred Nachi waterfall.',
  'Nachikatsuura · 那智勝浦',
  '{"type":"LineString","coordinates":[[135.8940,33.6589],[135.8938,33.6603],[135.8934,33.6616],[135.8929,33.6630],[135.8925,33.6643],[135.8920,33.6656],[135.8914,33.6668],[135.8904,33.6681],[135.8899,33.6697],[135.8890,33.6701],[135.8887,33.6710],[135.8877,33.6743]]}',
  1900, 'public', true
);

-- ============================================================ photographed waypoint stories

do $seed$
begin

create temporary table seed_curated_waypoints (
  stop_id uuid,
  media_id uuid,
  waypoint_id uuid,
  route_id uuid,
  sort_index integer,
  lat double precision,
  lng double precision,
  time_period text,
  title text,
  title_ja text,
  story text,
  asset text,
  alt_text text,
  media_credit text,
  media_license text,
  media_source_url text
);

insert into seed_curated_waypoints values
-- Philosopher's Path / 哲学の道
('11000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',0,35.0268,135.7942,'Meiji era (1868–1912)','The Lake Biwa Canal','琵琶湖疏水','The path follows a branch of the Lake Biwa Canal system, whose water helped power and modernize Kyoto in the late nineteenth century.','sakura-canal.webp','Cherry blossoms arch over the Philosopher''s Path canal.','Reggaeman','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Tetsugaku_no_Michi_01.JPG'),
('11000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',1,35.0254,135.7946,'15th century','Ginkaku-ji approach','銀閣寺参道','The northern approach recalls the Higashiyama culture fostered by shogun Ashikaga Yoshimasa at his retirement villa, later Ginkaku-ji.','stone-bridge.webp','A stone bridge crosses the narrow canal near Ginkaku-ji.','Gzzz','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Tetsugaku-no-michi_-_Philosopher%27s_Walk_-_Kyoto.jpg'),
('11000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',2,35.0240,135.7944,'Early 20th century','Nishida''s daily walk','西田幾多郎の散歩道','Kyoto University philosopher Nishida Kitarō is remembered for using this canal-side walk as a daily practice of reflection.','sakura-canal.webp','Spring light filters through cherry trees above the canal.','Reggaeman','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Tetsugaku_no_Michi_01.JPG'),
('11000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001',3,35.0227,135.7947,'Edo period (1603–1868)','Hōnen-in turnoff','法然院への道','A quiet lane leaves the canal for Hōnen-in, one of several temple detours that make the walk part path and part pilgrimage.','stone-bridge.webp','The tree-lined canal beside the turn toward Hōnen-in.','Gzzz','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Tetsugaku-no-michi_-_Philosopher%27s_Walk_-_Kyoto.jpg'),
('11000000-0000-4000-8000-000000000005','61000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001',4,35.0213,135.7945,'Living tradition','Ōtoyo Shrine lane','大豊神社参道','The lane toward Ōtoyo Shrine shows how neighborhood shrines, homes, and the canal remain woven into one lived landscape.','sakura-canal.webp','A narrow canal shaded by flowering branches in Higashiyama.','Reggaeman','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Tetsugaku_no_Michi_01.JPG'),
('11000000-0000-4000-8000-000000000006','61000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',5,35.0199,135.7948,'Canal landscape','Small stone bridges','小さな石橋','Frequent footbridges turn the canal from a boundary into a shared neighborhood route, joining the path to lanes on both banks.','stone-bridge.webp','A small stone bridge spans the Philosopher''s Path canal.','Gzzz','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Tetsugaku-no-michi_-_Philosopher%27s_Walk_-_Kyoto.jpg'),
('11000000-0000-4000-8000-000000000007','61000000-0000-4000-8000-000000000007','51000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001',6,35.0186,135.7946,'20th century','A path gains its name','哲学の道','The name Tetsugaku no Michi—Philosopher''s Path—gave a local canal walk a public identity rooted in contemplation.','sakura-canal.webp','The Philosopher''s Path follows a cherry-lined waterway.','Reggaeman','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Tetsugaku_no_Michi_01.JPG'),
('11000000-0000-4000-8000-000000000008','61000000-0000-4000-8000-000000000008','51000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001',7,35.0172,135.7949,'Seasonal Kyoto','The cherry corridor','桜の回廊','Cherry trees frame the water each spring, while summer shade and autumn color keep the same narrow route changing through the year.','stone-bridge.webp','Trees and a low bridge frame the canal-side path.','Gzzz','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Tetsugaku-no-michi_-_Philosopher%27s_Walk_-_Kyoto.jpg'),
('11000000-0000-4000-8000-000000000009','61000000-0000-4000-8000-000000000009','51000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001',8,35.0145,135.7950,'9th century','Eikan-dō','永観堂','Near the southern end, Eikan-dō—formally Zenrin-ji—connects the walk to a temple founded in the ninth century and renowned for autumn maples.','sakura-canal.webp','Cherry trees lean over the canal near the southern path.','Reggaeman','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Tetsugaku_no_Michi_01.JPG'),
('11000000-0000-4000-8000-000000000010','61000000-0000-4000-8000-000000000010','51000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',9,35.0111,135.7943,'13th century','Nanzen-ji gateway','南禅寺門前','The canal walk ends near Nanzen-ji, where an imperial villa became a major Zen temple at the foot of Kyoto''s eastern hills.','stone-bridge.webp','The canal and stone crossings near the route''s southern end.','Gzzz','CC BY 4.0','https://commons.wikimedia.org/wiki/File:Tetsugaku-no-michi_-_Philosopher%27s_Walk_-_Kyoto.jpg'),
-- Nakasendo / 中山道
('11000000-0000-4000-8000-000000000011','61000000-0000-4000-8000-000000000011','51000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000002',0,35.5266,137.5695,'Edo period (1603–1868)','Magome-juku','馬籠宿','Magome was one of the Nakasendo''s sixty-nine post towns, where travelers found lodging, food, porters, and fresh horses.','post-town.webp','Wooden houses line the sloped main street of a preserved post town.','皓月旗','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Tsumago-juku_6-Jun-2020.jpg'),
('11000000-0000-4000-8000-000000000012','61000000-0000-4000-8000-000000000012','51000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000002',1,35.5330,137.5731,'Tokugawa shogunate','The public notice board','高札場','A kōsatsuba displayed official laws and notices where residents and travelers entering the post town could read them.','post-town.webp','Dark timber façades recall the Nakasendo''s post-town streets.','皓月旗','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Tsumago-juku_6-Jun-2020.jpg'),
('11000000-0000-4000-8000-000000000013','61000000-0000-4000-8000-000000000013','51000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000002',2,35.5392,137.5770,'Edo road engineering','Stone-paved ascent','石畳の坂','Stone paving gave feet and packhorses firmer ground on steep, rain-soaked sections of the mountain road.','cedar-trail.webp','A stone-and-earth trail runs beneath cedars and autumn leaves.','Daderot','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Nakasendo_between_Tsumago_and_Magome_-_Nov_2005.jpg'),
('11000000-0000-4000-8000-000000000014','61000000-0000-4000-8000-000000000014','51000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000002',3,35.5455,137.5808,'Edo period (1603–1868)','The road through the cedars','杉木立の古道','This forested stretch follows the inland highway that carried officials, merchants, pilgrims, and messages between Kyoto and Edo.','cedar-trail.webp','A Nakasendo trail sign stands beneath autumn maple trees.','Daderot','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Nakasendo_between_Tsumago_and_Magome_-_Nov_2005.jpg'),
('11000000-0000-4000-8000-000000000015','61000000-0000-4000-8000-000000000015','51000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000002',4,35.5518,137.5845,'Roadside faith','Travelers'' guardians','道祖神','Small Jizō and dōsojin figures beside the road reflect prayers for safe passage, healthy communities, and protection at boundaries.','cedar-trail.webp','A wooded Nakasendo trail passes mossy roadside ground.','Daderot','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Nakasendo_between_Tsumago_and_Magome_-_Nov_2005.jpg'),
('11000000-0000-4000-8000-000000000016','61000000-0000-4000-8000-000000000016','51000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000002',5,35.5580,137.5880,'Edo period (1603–1868)','Ichikokutochi rest house','一石栃立場茶屋','The surviving tateba rest house marks a place where walkers paused between official post towns and gathered around the hearth.','post-town.webp','Traditional timber architecture recalls an Edo-period rest house.','皓月旗','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Tsumago-juku_6-Jun-2020.jpg'),
('11000000-0000-4000-8000-000000000017','61000000-0000-4000-8000-000000000017','51000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000002',6,35.5622,137.5896,'Kiso forest','Bells on the trail','熊よけの鐘','Today''s walkers ring bells along quiet forest sections, a practical warning that the old highway still crosses bear country.','cedar-trail.webp','A shaded Nakasendo footpath winds through the Kiso forest.','Daderot','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Nakasendo_between_Tsumago_and_Magome_-_Nov_2005.jpg'),
('11000000-0000-4000-8000-000000000018','61000000-0000-4000-8000-000000000018','51000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000002',7,35.5664,137.5912,'Roadside landmark','Otake and Medaki','男滝・女滝','The paired Otake and Medaki waterfalls give the long forest crossing a natural landmark just outside Tsumago.','cedar-trail.webp','Forest light and autumn color surround the historic mountain road.','Daderot','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Nakasendo_between_Tsumago_and_Magome_-_Nov_2005.jpg'),
('11000000-0000-4000-8000-000000000019','61000000-0000-4000-8000-000000000019','51000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000002',8,35.5745,137.5938,'Edo period (1603–1868)','Tsumago-juku','妻籠宿','Tsumago preserves the scale and rhythm of a post town where travelers once found lodging, supplies, and transport onward.','post-town.webp','Wooden Edo-period houses line Tsumago''s preserved street.','皓月旗','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Tsumago-juku_6-Jun-2020.jpg'),
('11000000-0000-4000-8000-000000000020','61000000-0000-4000-8000-000000000020','51000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000002',9,35.5774,137.5945,'Post-town life','Waki-honjin Okuya','脇本陣奥谷','The waki-honjin served as secondary official lodging, revealing the hierarchy and careful logistics behind travel on the shogunate road.','post-town.webp','A preserved timber streetscape in Tsumago-juku.','皓月旗','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Tsumago-juku_6-Jun-2020.jpg'),
-- Kumano Kodo / 熊野古道
('11000000-0000-4000-8000-000000000021','61000000-0000-4000-8000-000000000021','51000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000003',0,33.6589,135.8940,'Over 1,000 years','Nakahechi pilgrims','中辺路の巡礼','Retired emperors, aristocrats, and ordinary pilgrims used the Nakahechi network to cross the Kii Peninsula toward Kumano''s sacred sites.','kumano-daimonzaka.webp','The stone Daimon-zaka path climbs between immense cedar trees.','NY066','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Kumanokodo-Daimonzaka.JPG'),
('11000000-0000-4000-8000-000000000022','61000000-0000-4000-8000-000000000022','51000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000003',1,33.6603,135.8938,'Historic approach','Daimon-zaka entrance','大門坂入口','Daimon-zaka means “large gate slope,” recalling a gate that once stood near the beginning of this short pilgrimage ascent.','kumano-daimonzaka.webp','Mossy stone steps mark the entrance to Daimon-zaka.','NY066','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Kumanokodo-Daimonzaka.JPG'),
('11000000-0000-4000-8000-000000000023','61000000-0000-4000-8000-000000000023','51000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000003',2,33.6616,135.8934,'Centuries-old cedars','Meoto-sugi','夫婦杉','At the base of the slope, the intertwined roots of the Meoto-sugi—“husband and wife cedars”—form a living threshold to the old road.','kumano-daimonzaka.webp','Twin ancient cedars rise beside Daimon-zaka''s stone staircase.','NY066','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Kumanokodo-Daimonzaka.JPG'),
('11000000-0000-4000-8000-000000000024','61000000-0000-4000-8000-000000000024','51000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000003',3,33.6630,135.8929,'14th-century route','Two hundred sixty-seven steps','二百六十七段','The roughly six-hundred-metre stone staircase climbs in 267 steps beneath cedars, cypress, camphor, and bamboo.','kumano-daimonzaka.webp','Uneven historic stones climb through the cedar forest.','NY066','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Kumanokodo-Daimonzaka.JPG'),
('11000000-0000-4000-8000-000000000025','61000000-0000-4000-8000-000000000025','51000000-0000-4000-8000-000000000025','10000000-0000-4000-8000-000000000003',4,33.6643,135.8925,'Sacred landscape','Cedar and camphor canopy','杉と楠の参詣道','The dense canopy turns the physical climb into a passage between the settled valley and the sacred precincts of Nachisan.','kumano-daimonzaka.webp','Towering cedar trunks enclose the old pilgrimage stair.','NY066','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Kumanokodo-Daimonzaka.JPG'),
('11000000-0000-4000-8000-000000000026','61000000-0000-4000-8000-000000000026','51000000-0000-4000-8000-000000000026','10000000-0000-4000-8000-000000000003',5,33.6656,135.8920,'UNESCO inscription (2004)','A World Heritage path','世界遺産の道','The Kumano Kodo forms part of UNESCO''s Sacred Sites and Pilgrimage Routes in the Kii Mountain Range cultural landscape.','kumano-daimonzaka.webp','The Kumano Kodo''s stone path continues through deep forest.','NY066','CC BY-SA 3.0','https://commons.wikimedia.org/wiki/File:Kumanokodo-Daimonzaka.JPG'),
('11000000-0000-4000-8000-000000000027','61000000-0000-4000-8000-000000000027','51000000-0000-4000-8000-000000000027','10000000-0000-4000-8000-000000000003',6,33.6668,135.8914,'Sacred landscape','First view of Nachisan','那智山遥拝','Near the top, the forest opens toward a mountaintop sanctuary where shrine, temple, and waterfall have long been understood together.','kumano-pagoda-falls.webp','Seiganto-ji''s pagoda stands before forest and Nachi Falls.','Suikotei','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Seiganto-ji_Three-storied_Pagoda_and_Nachi_Falls.jpg'),
('11000000-0000-4000-8000-000000000028','61000000-0000-4000-8000-000000000028','51000000-0000-4000-8000-000000000028','10000000-0000-4000-8000-000000000003',7,33.6697,135.8899,'Worship since the 4th century','Kumano Nachi Taisha','熊野那智大社','The grand shrine grew from worship of the waterfall and surrounding forest, a natural focus of devotion since ancient times.','kumano-taisha.webp','Vermilion halls of Kumano Nachi Taisha stand against the forest.','Fg2','Public domain','https://commons.wikimedia.org/wiki/File:KumanoNachiTaisha.jpg'),
('11000000-0000-4000-8000-000000000029','61000000-0000-4000-8000-000000000029','51000000-0000-4000-8000-000000000029','10000000-0000-4000-8000-000000000003',8,33.6701,135.8890,'Pilgrimage recorded from 1161','Seiganto-ji','青岸渡寺','Beside the shrine, Seiganto-ji is the first sacred place of the Saigoku pilgrimage to thirty-three images of Kannon.','kumano-pagoda-falls.webp','The three-storied Seiganto-ji pagoda frames Nachi Falls.','Suikotei','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Seiganto-ji_Three-storied_Pagoda_and_Nachi_Falls.jpg'),
('11000000-0000-4000-8000-000000000030','61000000-0000-4000-8000-000000000030','51000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000003',9,33.6743,135.8877,'Ancient waterfall worship','Nachi no Ōtaki','那智の大滝','Nachi Falls drops 133 metres in a single plunge, the natural presence around which Nachisan''s sacred landscape formed.','kumano-pagoda-falls.webp','Nachi Falls descends behind Seiganto-ji''s vermilion pagoda.','Suikotei','CC BY-SA 4.0','https://commons.wikimedia.org/wiki/File:Seiganto-ji_Three-storied_Pagoda_and_Nachi_Falls.jpg');

insert into public.walk_stops (id, walk_id, kind, sort_index, lat, lng, note)
select stop_id, route_id, 'photo', sort_index, lat, lng, title || ' — ' || story
from seed_curated_waypoints;

insert into public.walk_media (
  id, stop_id, bucket, storage_path, alt_text, original_filename, mime_type, orientation
)
select media_id, stop_id, 'curated', asset, alt_text, asset, 'image/webp', 1
from seed_curated_waypoints;

insert into public.curated_waypoints (
  id, route_id, lat, lng, time_period, title, title_ja, story, media_id,
  sort_index, media_credit, media_license, media_source_url
)
select waypoint_id, route_id, lat, lng, time_period, title, title_ja, story,
  media_id, sort_index, media_credit, media_license, media_source_url
from seed_curated_waypoints;

drop table seed_curated_waypoints;

end;
$seed$;

-- Small personal fixtures exercise both the overlap and no-match replay paths.
insert into public.walks (
  id, owner_id, title, description, region, path, distance_m, visibility
) values
(
  '12000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'An afternoon in Tsumago',
  'Two personal moments beside the old post road.',
  'Tsumago, Nagano',
  '{"type":"LineString","coordinates":[[137.5938,35.5745],[137.5942,35.5745]]}',
  40,
  'private'
),
(
  '12000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'A plain walk in Sapporo',
  'A fixture outside every curated waypoint radius.',
  'Sapporo, Hokkaido',
  '{"type":"LineString","coordinates":[[141.3545,43.0621],[141.3552,43.0624]]}',
  70,
  'private'
);

insert into public.walk_stops (
  id, walk_id, kind, sort_index, captured_at, lat, lng, note
) values
(
  '41000000-0000-4000-8000-000000000101',
  '12000000-0000-4000-8000-000000000001',
  'note',
  0,
  '2026-04-12 05:10:00+00',
  35.5745,
  137.5938,
  'Rain eased beneath the eaves.'
),
(
  '41000000-0000-4000-8000-000000000102',
  '12000000-0000-4000-8000-000000000001',
  'note',
  1,
  '2026-04-12 05:25:00+00',
  35.5745,
  137.5942,
  'I turned back for one last look down the old road.'
),
(
  '41000000-0000-4000-8000-000000000103',
  '12000000-0000-4000-8000-000000000002',
  'note',
  0,
  '2026-02-08 03:00:00+00',
  43.0621,
  141.3545,
  'Fresh snow along the block.'
),
(
  '41000000-0000-4000-8000-000000000104',
  '12000000-0000-4000-8000-000000000002',
  'note',
  1,
  '2026-02-08 03:15:00+00',
  43.0624,
  141.3552,
  'Warm light from the corner shop.'
);

-- ============================================================ likes (recent, so Trending has data)

insert into public.likes (walk_id, user_id, created_at) values
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', now() - interval '1 day'),
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', now() - interval '2 days'),
('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', now() - interval '3 days'),
('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', now() - interval '1 day'),
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
 'The cedars and old stones make even this short climb feel far from the road below.', now() - interval '4 days');
