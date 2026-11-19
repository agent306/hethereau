/**
 * Official NTE / Hethereau character posters, banner splash artwork, and structured V1.5 event calendar.
 * Character posters & promotional key art are served directly from Perfect World Games' official CDN
 * (`nte.perfectworld.com`), with verified fallbacks to local `/avatars/<id>.png`.
 */

export const OFFICIAL_VERSION_KEY_ART =
  'https://nte.perfectworld.com/en/images/cover261111/slide2.jpg';

export const OFFICIAL_CHARACTER_POSTERS = {
  // Limited S-Class Characters
  '1090': 'https://nte.perfectworld.com/public/m/images/main261111/role-poster-yem.png', // Elyms
  '1057': 'https://nte.perfectworld.com/public/m/images/main261021/role-poster-mingyin.png', // Akane Rin
  '1042': 'https://nte.perfectworld.com/public/m/images/main260930/role-poster-heiyu.png', // Blackbird
  '1072': 'https://nte.perfectworld.com/public/m/images/main260909/role-poster-lingke.png', // Linko
  '1036': 'https://nte.perfectworld.com/public/m/images/main260819/role-poster-canhong.png', // Zankou
  '1075': 'https://nte.perfectworld.com/public/m/images/main260729/role-poster-yi.png', // Iroi
  '1076': 'https://nte.perfectworld.com/public/m/images/main260708/role-poster-zhen.png', // Shinku
  '1071': 'https://nte.perfectworld.com/public/m/images/main260618/role-poster-ka.png', // Chaos
  '1004': 'https://nte.perfectworld.com/public/m/images/main260603/role-poster-an.png', // Lacrimosa
  '1052': 'https://nte.perfectworld.com/public/m/images/main260513/role-poster-xun.png', // Hotori
  '1010': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-nanally.png', // Nanally
  '1074':
    'https://raw.githubusercontent.com/Waifus-Grace/NTE_Assets/main/UI/Gacha/Lottery_Img/Exe/YH_UI_Activity_Big_exe3.png', // Exe (V1.5 Phase 2)

  // Standard S-Class & A-Class Characters
  '1023': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-baicang.png', // Baicang
  '1054': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-dfde.png', // Daffodill
  '1039': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-fadiya.png', // Fadia
  '1025': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-hasuoer.png', // Hathor
  '1055': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-jiuyuan.png', // Jiuyuan
  '1003': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-zaowu.png', // Sakiri
  '1019': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-mint.png', // Mint
  '1073': 'https://nte.perfectworld.com/public/m/images/main260402/role-poster-xiaozhi.png', // Chiz
};

export const BANNER_FEATURED_META = {
  Lottery_YeErMu: {
    title: 'Android Dreams',
    charId: '1090',
    charName: 'Elyms',
    arcBanner: 'Echo Special',
    accent: '#2ee6ff',
    rateUpA: ['1019', '1021', '1033'], // Mint, Edgar, Adler
    cosmetics: ['Joy Buoy (50)', '+Friend & Rescue+ Livery (120)', 'Drifting Petals Outfit (200)'],
  },
  Lottery_ZhenHong: {
    title: 'Before the Dawn',
    charId: '1076',
    charName: 'Shinku',
    arcBanner: 'Resolve Special',
    accent: '#f43f5e',
    rateUpA: ['1019', '1021', '1033'],
    cosmetics: ['Overcast Canopy (50)', 'Hidden Dragon Livery (120)', 'Student of Terrasea Outfit (200)'],
  },
  Lottery_Exe: {
    title: 'Offline Equations',
    charId: '1074',
    charName: 'Exe',
    arcBanner: 'Encryption Special',
    accent: '#a855f7',
    rateUpA: [],
    cosmetics: ['V1.5 Phase 2 Limited Board'],
  },
  Lottery_Kaesi: {
    title: 'Forsaken Path',
    charId: '1071',
    charName: 'Chaos',
    arcBanner: 'Pursuit Special',
    accent: '#f5c451',
    rateUpA: [],
    cosmetics: ['V1.5 Phase 2 Rerun Board'],
  },
  Lottery_MingYin: {
    title: 'Dazzling Star',
    charId: '1057',
    charName: 'Akane Rin',
    arcBanner: 'Celestial Special',
    accent: '#f59e0b',
  },
  Lottery_HeiYu: {
    title: 'Foretold Finale',
    charId: '1042',
    charName: 'Blackbird',
    arcBanner: 'Roostfeather Special',
    accent: '#eab308',
  },
  Lottery_LingKe: {
    title: 'Surfing All Channels!',
    charId: '1072',
    charName: 'Linko',
    arcBanner: 'Soundscape Special',
    accent: '#ec4899',
  },
  Lottery_Canhong: {
    title: 'Alluring Shadows',
    charId: '1036',
    charName: 'Zankou',
    arcBanner: 'Spellbound Special',
    accent: '#fb7185',
  },
  Lottery_Yiluoyi: {
    title: 'The Lifeline',
    charId: '1075',
    charName: 'Iroi',
    arcBanner: 'Dreamgate Special',
    accent: '#34d399',
  },
  Lottery_AnHunQu: {
    title: 'Fading Reverie',
    charId: '1004',
    charName: 'Lacrimosa',
    arcBanner: 'Nocturne Special',
    accent: '#c084fc',
  },
  Lottery_Xun: {
    title: 'Misty Tipsy Style',
    charId: '1052',
    charName: 'Hotori',
    arcBanner: 'Bright Moon Special',
    accent: '#ef4444',
  },
  Lottery_Nanali: {
    title: 'The Ichi-daime',
    charId: '1010',
    charName: 'Nanally',
    arcBanner: 'Tiger Special',
    accent: '#f59e0b',
  },
};

export function getCharacterPoster(charId) {
  return OFFICIAL_CHARACTER_POSTERS[String(charId)] || `/avatars/${charId}.png`;
}

export function getBannerSplash(sourceId) {
  const meta = BANNER_FEATURED_META[sourceId];
  if (meta?.charId) {
    return getCharacterPoster(meta.charId);
  }
  return OFFICIAL_VERSION_KEY_ART;
}

/**
 * Structured Version 1.5 ("Once Upon a Glitched Call") Official Calendar Timeline.
 * Dates are exact UTC+8 official windows from Perfect World Games' V1.5 Patch Notes.
 */
export const OFFICIAL_TIMELINE_EVENTS = [
  {
    id: 'v15_elyms_board',
    title: 'Android Dreams — Elyms (New)',
    subtitle: 'Scarborough Fair Limited Board + Echo Special Arc',
    category: 'banner',
    color: '#f5c451',
    charId: '1090',
    sourceId: 'Lottery_YeErMu',
    start: '2026-11-11T11:00:00+08:00',
    end: '2026-12-02T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_shinku_rerun',
    title: 'Before the Dawn — Shinku (Rerun)',
    subtitle: 'Scarborough Fair Rerun Board + Resolve Special Arc',
    category: 'banner',
    color: '#fb7185',
    charId: '1076',
    sourceId: 'Lottery_ZhenHong',
    start: '2026-11-11T11:00:00+08:00',
    end: '2026-12-02T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_exe_board',
    title: 'Offline Equations — Exe (Upcoming)',
    subtitle: 'V1.5 Phase 2 Limited Board + Encryption Special Arc',
    category: 'banner',
    color: '#a855f7',
    charId: '1074',
    sourceId: 'Lottery_Exe',
    start: '2026-11-26T06:00:00+08:00',
    end: '2026-12-23T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_chaos_rerun',
    title: 'Forsaken Path — Chaos (Upcoming Rerun)',
    subtitle: 'V1.5 Phase 2 Rerun Board + Pursuit Special Arc',
    category: 'banner',
    color: '#f59e0b',
    charId: '1071',
    sourceId: 'Lottery_Kaesi',
    start: '2026-11-26T06:00:00+08:00',
    end: '2026-12-23T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_mystery_box',
    title: 'Mystery Box: Open Roads Ahead',
    subtitle: 'Vehicles "Iron Ogre" & "Prototype Land Overlord 001", Fabricated Dice',
    category: 'mystery_box',
    color: '#ec4899',
    start: '2026-11-11T11:00:00+08:00',
    end: '2026-12-23T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_city_logistics',
    title: 'City Logistics Limited-Time Event',
    subtitle: 'Free vehicles C001 & Ori-LV03, Annulith, Fabricated Dice, Kool Shop',
    category: 'event',
    color: '#2ee6ff',
    start: '2026-11-11T11:00:00+08:00',
    end: '2026-12-23T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_hunters_crucible',
    title: "Hunter's Crucible: Breakthrough",
    subtitle: 'Combat Challenge Stages — Annulith, Fabricated Dice & Blade Honed Title',
    category: 'event',
    color: '#38bdf8',
    start: '2026-11-11T11:00:00+08:00',
    end: '2026-12-23T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_circle_gifts',
    title: 'Circle Gifts Login Event',
    subtitle: 'Daily check-in rewards throughout Version 1.5',
    category: 'login',
    color: '#34d399',
    start: '2026-11-11T11:00:00+08:00',
    end: '2026-12-23T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_y2k_mystique',
    title: 'Elyms "Y2K Mystique" Outfit Discount',
    subtitle: 'Limited-time shop launch discount',
    category: 'shop',
    color: '#c084fc',
    charId: '1090',
    start: '2026-11-11T11:00:00+08:00',
    end: '2026-12-23T05:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gamenews/20261109/264948.html',
  },
  {
    id: 'v15_fan_creation',
    title: 'NTE V1.5 Fan Creation Event',
    subtitle: 'Official community contest — win up to $1,000 + Annulith x6,480',
    category: 'community',
    color: '#fbbf24',
    start: '2026-11-04T00:00:00+08:00',
    end: '2026-12-16T23:59:00+08:00',
    url: 'https://nte.perfectworld.com/en/article/news/gameevent/20261104/264885.html',
  },
];
