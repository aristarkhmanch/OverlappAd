// ================= CastGraph — SEED DATA (Neo4j) =================
// Paste into Neo4j Browser and run. Statements are separated by ';' — run all.
// Rigged so that for the hero brief (matcha drink, Gen-Z) matched to CS_Hero:
//   WINNERS (mid-tier, high overlap, positive lift): @matchamaven, @cleanfuelkate, @sipwithsoraya
//   DECOYS  (big followers, low overlap): @flavorbomb_eats, @gainzgarage, @wanderlux, @pixelplays
// Verification query is at the very bottom.

// ---- constraints (optional but nice) ----
CREATE CONSTRAINT creator_handle IF NOT EXISTS FOR (c:Creator)         REQUIRE c.handle IS UNIQUE;
CREATE CONSTRAINT aud_id        IF NOT EXISTS FOR (a:AudienceSegment)  REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT cust_id       IF NOT EXISTS FOR (s:CustomerSegment)  REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT brand_name    IF NOT EXISTS FOR (b:Brand)            REQUIRE b.name IS UNIQUE;
CREATE CONSTRAINT camp_id       IF NOT EXISTS FOR (k:Campaign)         REQUIRE k.id IS UNIQUE;

// ---- 1) Customer segments (hero + 2 others) ----
UNWIND [
  {id:'CS_Hero',    name:'Matcha-curious Gen-Z women (CA+NY)', description:'Gen-Z women 18-24, CA+NY, matcha/wellness drinks + aesthetic lifestyle'},
  {id:'CS_Home',    name:'Millennial home cooks',              description:'Suburban families 28-45, weeknight cooking + meal kits'},
  {id:'CS_FitMale', name:'Male fitness enthusiasts',           description:'Men 25-40, gym, supplements, performance'}
] AS x
MERGE (s:CustomerSegment {id:x.id}) SET s.name=x.name, s.description=x.description;

// ---- 2) Audience segments ----
UNWIND [
  {id:'AS_MatchaGenZ',    name:'Matcha & wellness drinks, Gen-Z women', ageBand:'18-24', geo:'CA+NY',      interests:'matcha,wellness,aesthetic'},
  {id:'AS_CleanWellness', name:'Clean-eating wellness, young women',     ageBand:'18-27', geo:'US-West',    interests:'clean eating,supplements'},
  {id:'AS_Aesthetic',     name:'That-girl aesthetic lifestyle, Gen-Z',  ageBand:'18-24', geo:'US-urban',   interests:'aesthetic,lifestyle,routines'},
  {id:'AS_FitnessGenZ',   name:'Gen-Z fitness & smoothies',             ageBand:'18-26', geo:'US',          interests:'fitness,smoothies'},
  {id:'AS_BeautyGenZ',    name:'Gen-Z beauty & skincare',              ageBand:'16-24', geo:'US',          interests:'beauty,skincare'},
  {id:'AS_FoodieMil',     name:'Millennial foodies',                    ageBand:'28-40', geo:'US',          interests:'restaurants,foodie'},
  {id:'AS_GamingMale',    name:'Gaming, young men',                     ageBand:'16-28', geo:'US',          interests:'gaming,esports'},
  {id:'AS_DadFitness',    name:'Fitness, men 30+',                      ageBand:'30-45', geo:'US',          interests:'gym,supplements'},
  {id:'AS_LuxTravel',     name:'Luxury travel',                         ageBand:'30-50', geo:'global',      interests:'travel,luxury'},
  {id:'AS_HomeCooking',   name:'Home cooking families',                 ageBand:'30-50', geo:'US-suburban', interests:'cooking,meal kits'},
  {id:'AS_CollegeLife',   name:'College lifestyle, mixed',              ageBand:'18-23', geo:'US',          interests:'college,budget,lifestyle'},
  {id:'AS_Sustain',       name:'Sustainable living, young women',       ageBand:'20-30', geo:'CA+NY',       interests:'sustainability,clean beauty'}
] AS x
MERGE (a:AudienceSegment {id:x.id}) SET a.name=x.name, a.ageBand=x.ageBand, a.geo=x.geo, a.interests=x.interests;

// ---- 3) Brands ----
UNWIND [
  {name:'Oatly',category:'beverage'},{name:'VitalProteins',category:'wellness'},{name:'Poppi',category:'beverage'},
  {name:'Olipop',category:'beverage'},{name:'DoorDash',category:'delivery'},{name:'Gymshark',category:'fitness apparel'},
  {name:'Chipotle',category:'food'},{name:'Glossier',category:'beauty'},{name:'HelloFresh',category:'food'},
  {name:'LiquidIV',category:'wellness'},{name:'AlaniNu',category:'beverage'},{name:'BloomNutrition',category:'wellness'}
] AS x
MERGE (b:Brand {name:x.name}) SET b.category=x.category;

// ---- 4) Campaigns ----
UNWIND [
  {id:'C_OatlyBarista', name:'Oat-Milk Barista', product:'oat milk',        year:2025},
  {id:'C_VitalGlow',    name:'Glow Collagen',    product:'collagen',        year:2025},
  {id:'C_PoppiSoda',    name:'Prebiotic Soda Launch', product:'prebiotic soda', year:2026},
  {id:'C_OlipopSummer', name:'Summer Soda',      product:'prebiotic soda',  year:2025},
  {id:'C_GymsharkDrop', name:'Seamless Drop',    product:'apparel',         year:2025},
  {id:'C_GlossierYou',  name:'You Fragrance',    product:'fragrance',       year:2024},
  {id:'C_HelloFreshBox',name:'Weeknight Box',    product:'meal kit',        year:2025},
  {id:'C_LiquidIVHydrate', name:'Hydration',     product:'hydration mix',   year:2026},
  {id:'C_AlaniEnergy',  name:'Energy Drink',     product:'energy drink',    year:2025},
  {id:'C_BloomGreens',  name:'Greens Powder',    product:'greens powder',   year:2026},
  {id:'C_ChipotleBowl', name:'Lifestyle Bowl',   product:'burrito bowl',    year:2025},
  {id:'C_DoorDashEats', name:'Late Night Eats',  product:'delivery',        year:2025},
  {id:'C_GymsharkPump', name:'Pump Cover',       product:'apparel',         year:2026},
  {id:'C_OlipopWinter', name:'Winter Flavors',   product:'prebiotic soda',  year:2026},
  {id:'C_BloomBoost',   name:'Pre-Workout',      product:'pre-workout',     year:2025},
  {id:'C_GlossierBalm', name:'Balm Dotcom',      product:'lip balm',        year:2025},
  {id:'C_LiquidIVSleep',name:'Sleep Multiplier', product:'sleep mix',       year:2026},
  {id:'C_PoppiBerry',   name:'Berry Launch',     product:'prebiotic soda',  year:2026}
] AS x
MERGE (k:Campaign {id:x.id}) SET k.name=x.name, k.product=x.product, k.year=x.year;

// ---- 5) Creators (42) ----
UNWIND [
  // winners (mid-tier, food/bev+wellness)
  {handle:'@matchamaven',   platform:'TikTok',    followers:92000,  niche:'food/beverage'},
  {handle:'@cleanfuelkate', platform:'Instagram', followers:138000, niche:'wellness'},
  {handle:'@sipwithsoraya', platform:'TikTok',    followers:61000,  niche:'food/beverage'},
  // decoys (big followers, low overlap)
  {handle:'@flavorbomb_eats',platform:'TikTok',   followers:1400000,niche:'food/beverage'},
  {handle:'@gainzgarage',   platform:'Instagram', followers:890000, niche:'fitness'},
  {handle:'@wanderlux',     platform:'Instagram', followers:2000000,niche:'travel/lifestyle'},
  {handle:'@pixelplays',    platform:'TikTok',    followers:1650000,niche:'gaming'},
  // filler
  {handle:'@greenglowgabi', platform:'Instagram', followers:220000, niche:'wellness'},
  {handle:'@brunchbabe',    platform:'Instagram', followers:340000, niche:'food'},
  {handle:'@liftwithliam',  platform:'TikTok',    followers:180000, niche:'fitness'},
  {handle:'@skinsecretsana',platform:'TikTok',    followers:410000, niche:'beauty'},
  {handle:'@cozykitchenco', platform:'Instagram', followers:260000, niche:'cooking'},
  {handle:'@thatgirldaily', platform:'TikTok',    followers:150000, niche:'lifestyle'},
  {handle:'@veganvibesval', platform:'Instagram', followers:95000,  niche:'wellness'},
  {handle:'@proteinpancake',platform:'TikTok',    followers:320000, niche:'fitness'},
  {handle:'@collegeeatss',  platform:'TikTok',    followers:210000, niche:'food'},
  {handle:'@glowgetterjade',platform:'Instagram', followers:175000, niche:'beauty'},
  {handle:'@roamwithria',   platform:'Instagram', followers:480000, niche:'travel'},
  {handle:'@plantpoweredpat',platform:'TikTok',   followers:130000, niche:'wellness'},
  {handle:'@snackattacksam',platform:'TikTok',    followers:290000, niche:'food'},
  {handle:'@fitfamfran',    platform:'Instagram', followers:240000, niche:'fitness'},
  {handle:'@aesthetically.amy',platform:'TikTok', followers:88000,  niche:'lifestyle'},
  {handle:'@gamergrace',    platform:'TikTok',    followers:520000, niche:'gaming'},
  {handle:'@cleaneatingclara',platform:'Instagram',followers:110000,niche:'wellness'},
  {handle:'@foodtruckfin',  platform:'TikTok',    followers:260000, niche:'food'},
  {handle:'@yogawithyuki',  platform:'Instagram', followers:145000, niche:'fitness'},
  {handle:'@beautybybex',   platform:'TikTok',    followers:380000, niche:'beauty'},
  {handle:'@sustainsienna', platform:'Instagram', followers:92000,  niche:'sustainability'},
  {handle:'@dormroomchef',  platform:'TikTok',    followers:165000, niche:'cooking'},
  {handle:'@macrosmax',     platform:'Instagram', followers:300000, niche:'fitness'},
  {handle:'@glowyskinguru', platform:'TikTok',    followers:205000, niche:'beauty'},
  {handle:'@wanderfoodie',  platform:'Instagram', followers:430000, niche:'travel/food'},
  {handle:'@matchamornings',platform:'Instagram', followers:70000,  niche:'wellness'},
  {handle:'@pilatesprincess',platform:'TikTok',   followers:155000, niche:'fitness'},
  {handle:'@budgetbites',   platform:'TikTok',    followers:340000, niche:'food'},
  {handle:'@crystalclean',  platform:'Instagram', followers:120000, niche:'wellness'},
  {handle:'@streetstylesol',platform:'Instagram', followers:275000, niche:'lifestyle'},
  {handle:'@gains.gary',    platform:'TikTok',    followers:610000, niche:'fitness'},
  {handle:'@teatimetara',   platform:'Instagram', followers:85000,  niche:'food'},
  {handle:'@mindfulmaya',   platform:'TikTok',    followers:190000, niche:'wellness'},
  {handle:'@urbanharvest',  platform:'Instagram', followers:135000, niche:'sustainability'},
  {handle:'@quickbitesqueen',platform:'TikTok',   followers:225000, niche:'food'}
] AS x
MERGE (c:Creator {handle:x.handle}) SET c.platform=x.platform, c.followers=x.followers, c.niche=x.niche;

// ---- 6) OVERLAPS: AudienceSegment -> CustomerSegment {pct} ----
UNWIND [
  {a:'AS_MatchaGenZ',   h:88,ho:10,f:5},  {a:'AS_CleanWellness',h:80,ho:25,f:20},
  {a:'AS_Aesthetic',    h:74,ho:15,f:8},  {a:'AS_FitnessGenZ',  h:55,ho:12,f:60},
  {a:'AS_BeautyGenZ',   h:40,ho:10,f:6},  {a:'AS_FoodieMil',    h:22,ho:78,f:20},
  {a:'AS_GamingMale',   h:5, ho:8, f:30}, {a:'AS_DadFitness',   h:8, ho:25,f:85},
  {a:'AS_LuxTravel',    h:6, ho:18,f:15}, {a:'AS_HomeCooking',  h:15,ho:82,f:22},
  {a:'AS_CollegeLife',  h:45,ho:20,f:35}, {a:'AS_Sustain',      h:62,ho:30,f:18}
] AS x
MATCH (a:AudienceSegment {id:x.a})
MATCH (hero:CustomerSegment {id:'CS_Hero'})
MATCH (home:CustomerSegment {id:'CS_Home'})
MATCH (fit:CustomerSegment  {id:'CS_FitMale'})
MERGE (a)-[r1:OVERLAPS]->(hero) SET r1.pct=x.h
MERGE (a)-[r2:OVERLAPS]->(home) SET r2.pct=x.ho
MERGE (a)-[r3:OVERLAPS]->(fit)  SET r3.pct=x.f;

// ---- 7) REACHES: Creator -> AudienceSegment {sharePct} (sums to 100 per creator) ----
UNWIND [
  // winners
  {h:'@matchamaven',   s:'AS_MatchaGenZ',   p:70},{h:'@matchamaven',   s:'AS_CleanWellness',p:20},{h:'@matchamaven',   s:'AS_Aesthetic',    p:10},
  {h:'@cleanfuelkate', s:'AS_CleanWellness',p:55},{h:'@cleanfuelkate', s:'AS_MatchaGenZ',   p:25},{h:'@cleanfuelkate', s:'AS_Sustain',      p:20},
  {h:'@sipwithsoraya', s:'AS_Aesthetic',    p:50},{h:'@sipwithsoraya', s:'AS_MatchaGenZ',   p:35},{h:'@sipwithsoraya', s:'AS_CleanWellness',p:15},
  // decoys
  {h:'@flavorbomb_eats',s:'AS_FoodieMil',   p:60},{h:'@flavorbomb_eats',s:'AS_HomeCooking', p:30},{h:'@flavorbomb_eats',s:'AS_CleanWellness',p:10},
  {h:'@gainzgarage',   s:'AS_DadFitness',   p:55},{h:'@gainzgarage',   s:'AS_FitnessGenZ',  p:30},{h:'@gainzgarage',   s:'AS_GamingMale',   p:15},
  {h:'@wanderlux',     s:'AS_LuxTravel',    p:70},{h:'@wanderlux',     s:'AS_Aesthetic',    p:20},{h:'@wanderlux',     s:'AS_FoodieMil',    p:10},
  {h:'@pixelplays',    s:'AS_GamingMale',   p:85},{h:'@pixelplays',    s:'AS_CollegeLife',  p:15},
  // filler
  {h:'@greenglowgabi', s:'AS_FitnessGenZ',  p:60},{h:'@greenglowgabi', s:'AS_CleanWellness',p:40},
  {h:'@brunchbabe',    s:'AS_FoodieMil',    p:70},{h:'@brunchbabe',    s:'AS_HomeCooking',  p:30},
  {h:'@liftwithliam',  s:'AS_DadFitness',   p:50},{h:'@liftwithliam',  s:'AS_FitnessGenZ',  p:50},
  {h:'@skinsecretsana',s:'AS_BeautyGenZ',   p:70},{h:'@skinsecretsana',s:'AS_Aesthetic',    p:30},
  {h:'@cozykitchenco', s:'AS_HomeCooking',  p:80},{h:'@cozykitchenco', s:'AS_FoodieMil',    p:20},
  {h:'@thatgirldaily', s:'AS_Aesthetic',    p:55},{h:'@thatgirldaily', s:'AS_CollegeLife',  p:45},
  {h:'@veganvibesval', s:'AS_Sustain',      p:55},{h:'@veganvibesval', s:'AS_CleanWellness',p:45},
  {h:'@proteinpancake',s:'AS_FitnessGenZ',  p:60},{h:'@proteinpancake',s:'AS_DadFitness',   p:40},
  {h:'@collegeeatss',  s:'AS_CollegeLife',  p:70},{h:'@collegeeatss',  s:'AS_FoodieMil',    p:30},
  {h:'@glowgetterjade',s:'AS_BeautyGenZ',   p:50},{h:'@glowgetterjade',s:'AS_Aesthetic',    p:50},
  {h:'@roamwithria',   s:'AS_LuxTravel',    p:80},{h:'@roamwithria',   s:'AS_Aesthetic',    p:20},
  {h:'@plantpoweredpat',s:'AS_Sustain',     p:60},{h:'@plantpoweredpat',s:'AS_CleanWellness',p:40},
  {h:'@snackattacksam',s:'AS_FoodieMil',    p:60},{h:'@snackattacksam',s:'AS_CollegeLife',  p:40},
  {h:'@fitfamfran',    s:'AS_DadFitness',   p:60},{h:'@fitfamfran',    s:'AS_FitnessGenZ',  p:40},
  {h:'@aesthetically.amy',s:'AS_Aesthetic', p:65},{h:'@aesthetically.amy',s:'AS_CollegeLife',p:35},
  {h:'@gamergrace',    s:'AS_GamingMale',   p:70},{h:'@gamergrace',    s:'AS_CollegeLife',  p:30},
  {h:'@cleaneatingclara',s:'AS_CleanWellness',p:50},{h:'@cleaneatingclara',s:'AS_FitnessGenZ',p:50},
  {h:'@foodtruckfin',  s:'AS_FoodieMil',    p:70},{h:'@foodtruckfin',  s:'AS_HomeCooking',  p:30},
  {h:'@yogawithyuki',  s:'AS_FitnessGenZ',  p:55},{h:'@yogawithyuki',  s:'AS_Sustain',      p:45},
  {h:'@beautybybex',   s:'AS_BeautyGenZ',   p:75},{h:'@beautybybex',   s:'AS_Aesthetic',    p:25},
  {h:'@sustainsienna', s:'AS_Sustain',      p:70},{h:'@sustainsienna', s:'AS_CleanWellness',p:30},
  {h:'@dormroomchef',  s:'AS_CollegeLife',  p:60},{h:'@dormroomchef',  s:'AS_HomeCooking',  p:40},
  {h:'@macrosmax',     s:'AS_DadFitness',   p:55},{h:'@macrosmax',     s:'AS_FitnessGenZ',  p:45},
  {h:'@glowyskinguru', s:'AS_BeautyGenZ',   p:60},{h:'@glowyskinguru', s:'AS_CleanWellness',p:40},
  {h:'@wanderfoodie',  s:'AS_LuxTravel',    p:65},{h:'@wanderfoodie',  s:'AS_FoodieMil',    p:35},
  {h:'@matchamornings',s:'AS_MatchaGenZ',   p:40},{h:'@matchamornings',s:'AS_CollegeLife',  p:60},
  {h:'@pilatesprincess',s:'AS_FitnessGenZ', p:55},{h:'@pilatesprincess',s:'AS_Aesthetic',   p:45},
  {h:'@budgetbites',   s:'AS_FoodieMil',    p:65},{h:'@budgetbites',   s:'AS_HomeCooking',  p:35},
  {h:'@crystalclean',  s:'AS_CleanWellness',p:45},{h:'@crystalclean',  s:'AS_Sustain',      p:55},
  {h:'@streetstylesol',s:'AS_Aesthetic',    p:50},{h:'@streetstylesol',s:'AS_BeautyGenZ',   p:50},
  {h:'@gains.gary',    s:'AS_DadFitness',   p:75},{h:'@gains.gary',    s:'AS_GamingMale',   p:25},
  {h:'@teatimetara',   s:'AS_FoodieMil',    p:65},{h:'@teatimetara',   s:'AS_MatchaGenZ',   p:35},
  {h:'@mindfulmaya',   s:'AS_Sustain',      p:60},{h:'@mindfulmaya',   s:'AS_FitnessGenZ',  p:40},
  {h:'@urbanharvest',  s:'AS_Sustain',      p:55},{h:'@urbanharvest',  s:'AS_HomeCooking',  p:45},
  {h:'@quickbitesqueen',s:'AS_FoodieMil',   p:55},{h:'@quickbitesqueen',s:'AS_CollegeLife', p:45}
] AS x
MATCH (c:Creator {handle:x.h}), (a:AudienceSegment {id:x.s})
MERGE (c)-[r:REACHES]->(a) SET r.sharePct=x.p;

// ---- 8) RAN + PERFORMED: Creator -> Campaign -> Brand {lift} ----
UNWIND [
  {h:'@matchamaven',    k:'C_OatlyBarista',   b:'Oatly',         lift:38},
  {h:'@cleanfuelkate',  k:'C_VitalGlow',      b:'VitalProteins', lift:27},
  {h:'@sipwithsoraya',  k:'C_PoppiSoda',      b:'Poppi',         lift:33},
  {h:'@greenglowgabi',  k:'C_OlipopSummer',   b:'Olipop',        lift:21},
  {h:'@liftwithliam',   k:'C_GymsharkDrop',   b:'Gymshark',      lift:18},
  {h:'@skinsecretsana', k:'C_GlossierYou',    b:'Glossier',      lift:15},
  {h:'@cozykitchenco',  k:'C_HelloFreshBox',  b:'HelloFresh',    lift:9},
  {h:'@proteinpancake', k:'C_LiquidIVHydrate',b:'LiquidIV',      lift:24},
  {h:'@thatgirldaily',  k:'C_AlaniEnergy',    b:'AlaniNu',       lift:29},
  {h:'@veganvibesval',  k:'C_BloomGreens',    b:'BloomNutrition',lift:31},
  {h:'@collegeeatss',   k:'C_ChipotleBowl',   b:'Chipotle',      lift:7},
  {h:'@flavorbomb_eats',k:'C_DoorDashEats',   b:'DoorDash',      lift:12},
  {h:'@gainzgarage',    k:'C_GymsharkPump',   b:'Gymshark',      lift:5},
  {h:'@cleaneatingclara',k:'C_OlipopWinter',  b:'Olipop',        lift:19},
  {h:'@yogawithyuki',   k:'C_BloomBoost',     b:'BloomNutrition',lift:14},
  {h:'@beautybybex',    k:'C_GlossierBalm',   b:'Glossier',      lift:11},
  {h:'@sustainsienna',  k:'C_LiquidIVSleep',  b:'LiquidIV',      lift:16},
  {h:'@matchamornings', k:'C_PoppiBerry',     b:'Poppi',         lift:22}
] AS x
MATCH (c:Creator {handle:x.h}), (k:Campaign {id:x.k}), (b:Brand {name:x.b})
MERGE (c)-[:RAN]->(k)
MERGE (k)-[p:PERFORMED]->(b) SET p.lift=x.lift;

// ================= VERIFICATION / THE MATCH QUERY =================
// Run this AFTER loading. It IS the CastGraph match for the hero brief.
// Expected top 3: @matchamaven, @sipwithsoraya, @cleanfuelkate (NOT the big-follower decoys).
//
// MATCH (c:Creator)-[r:REACHES]->(a:AudienceSegment)-[o:OVERLAPS]->(cs:CustomerSegment {id:'CS_Hero'})
// WITH c, sum(r.sharePct/100.0 * o.pct) AS audienceFit
// OPTIONAL MATCH (c)-[:RAN]->(:Campaign)-[p:PERFORMED]->()
// WITH c, audienceFit, coalesce(max(p.lift),0) AS bestLift
// RETURN c.handle AS creator, c.followers AS followers,
//        round(audienceFit,1) AS overlapToCustomers, bestLift,
//        round(audienceFit + bestLift*0.3,1) AS score
// ORDER BY score DESC LIMIT 5;
//
// To see the "why path" for one creator (what you render in the demo):
// MATCH path = (c:Creator {handle:'@matchamaven'})-[:REACHES]->(:AudienceSegment)-[:OVERLAPS]->(:CustomerSegment {id:'CS_Hero'})
// RETURN path;
