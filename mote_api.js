
Copy

// ═══════════════════════════════════════════════════════════════
// MOTE — YouTube API Layer
// Add to index.html before closing </script>
// Replace YOUR_YOUTUBE_API_KEY with your actual key
// ═══════════════════════════════════════════════════════════════
 
const YT_API_KEY = 'YOUR_YOUTUBE_API_KEY';
const YT_BASE    = 'https://www.googleapis.com/youtube/v3';
 
// ─── MOOD → SEARCH QUERIES ────────────────────────────────────
const MOOD_QUERIES = {
  joy: [
    'uplifting beautiful short documentary',
    'joyful celebration humanity film',
    'comedy sketch funny wholesome',
    'nature beauty satisfying craft',
    'music performance joy concert',
    'animals playful funny moments',
    'good news positive story documentary',
  ],
  trust: [
    'documentary community belonging',
    'craft tradition artisan process',
    'calm nature slow television',
    'behind the scenes making documentary',
    'japanese culture daily life',
    'restoration preservation craft',
    'architecture home living design',
  ],
  fear: [
    'investigative documentary threat risk',
    'climate change crisis documentary',
    'surveillance privacy technology risk',
    'economic collapse warning documentary',
    'pandemic disease preparedness documentary',
    'whistleblower exposed danger documentary',
    'existential risk AI future documentary',
  ],
  surprise: [
    'mind blowing science discovery',
    'counterintuitive history reframed',
    'unexpected truth documentary',
    'weird science phenomenon explained',
    'history you were never taught',
    'how things actually work surprising',
    'mathematical paradox explained',
  ],
  sadness: [
    'moving human story documentary',
    'grief loss tribute memorial film',
    'personal essay loneliness connection',
    'heartfelt human connection story',
    'obituary tribute legacy documentary',
    'difficult journey resilience film',
    'melancholy contemplative essay film',
  ],
  disgust: [
    'exposé corruption injustice documentary',
    'investigative journalism corruption',
    'corporate wrongdoing documentary',
    'systemic failure accountability film',
    'exploitation labor documentary',
    'environmental destruction documentary',
    'moral failure society documentary',
  ],
  anger: [
    'injustice documentary social justice',
    'inequality poverty systemic failure',
    'political corruption exposed documentary',
    'civil rights activism documentary',
    'protest movement documentary',
    'workers rights labor documentary',
    'racial justice documentary film',
  ],
  anticipation: [
    'future technology innovation documentary',
    'breakthrough science discovery',
    'entrepreneurship startup journey',
    'adventure exploration documentary',
    'space exploration future documentary',
    'emerging technology possibilities',
    'what comes next future documentary',
  ],
};
 
// ─── FILTER CONFIG ────────────────────────────────────────────
const ALLOWED_CATS = new Set([
  '1','2','10','15','17','18','22','23','24',
  '25','27','28','29','30','33','34','35','36','37','38'
]);
 
const TITLE_BLACKLIST = [
  /\bcompilation\b/i, /\bbest of\b/i, /\btop \d+\b/i,
  /\b#shorts?\b/i, /\bunboxing\b/i, /\bhaul\b/i,
  /\bprank\b/i, /\broast\b/i, /\btrailer\b/i,
  /full episode/i, /live stream/i, /\bhighlight(s)?\b/i,
  // Filter sequels — part 2, part 3, ep 2, episode 2 etc
  /\bpart [2-9]\b/i, /\bpart 1[0-9]\b/i,
  /\bep(isode)?\.?\s*[2-9]\b/i, /\bep(isode)?\.?\s*1[0-9]\b/i,
  /\bvol(ume)?\.?\s*[2-9]\b/i,
];
 
const REACTION_OK = [
  /professor|scientist|expert|physicist|historian|philosopher|researcher/i,
  /reacts? to.*(claim|theory|argument|research|paper|study)/i,
];
 
function titleOk(title) {
  const t = title.toLowerCase();
  if (/\breacts? to\b/i.test(t)) return REACTION_OK.some(r => r.test(t));
  return !TITLE_BLACKLIST.some(r => r.test(t));
}
 
function parseDuration(iso) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1]||0)*60 + (+m[2]||0) + (+m[3]||0)/60;
}
 
function durationBucket(mins) {
  if (mins < 20) return 'short';
  if (mins < 40) return 'medium';
  return 'long';
}
 
// ─── SESSION CACHE ────────────────────────────────────────────
const _cache = {};
function cacheGet(key) { return _cache[key] || null; }
function cacheSet(key, val) { _cache[key] = val; }
 
// ─── CORE API FUNCTIONS ───────────────────────────────────────
async function ytFetch(endpoint, params) {
  const url = new URL(`${YT_BASE}/${endpoint}`);
  url.searchParams.set('key', YT_API_KEY);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`YT API ${resp.status}`);
  return resp.json();
}
 
async function ytVideoDetails(ids) {
  if (!ids.length) return [];
  const cacheKey = `details:${ids.join(',')}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const data = await ytFetch('videos', {
    part: 'snippet,contentDetails,statistics,status',
    id: ids.join(','),
    maxResults: 50,
  });
  const result = data.items || [];
  cacheSet(cacheKey, result);
  return result;
}
 
async function ytSearch(query, opts = {}) {
  const cacheKey = `search:${query}:${JSON.stringify(opts)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
 
  const data = await ytFetch('search', {
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: opts.maxResults || 25,
    safeSearch: 'strict',
    relevanceLanguage: opts.lang || 'en',
    ...(opts.channelId ? { channelId: opts.channelId } : {}),
    ...(opts.order ? { order: opts.order } : {}),
  });
 
  const ids = (data.items || []).map(i => i.id.videoId).filter(Boolean);
  if (!ids.length) return [];
 
  const details = await ytVideoDetails(ids);
  const filtered = details.filter(v => {
    const dur   = parseDuration(v.contentDetails?.duration);
    const catId = v.snippet?.categoryId;
    return (
      v.status?.embeddable !== false &&
      dur >= 8 &&
      ALLOWED_CATS.has(catId) &&
      titleOk(v.snippet?.title || '') &&
      parseInt(v.statistics?.viewCount || 0) >= 500
    );
  });
 
  const result = filtered.map(v => videoToMoteItem(v));
  cacheSet(cacheKey, result);
  return result;
}
 
async function ytChannelVideos(channelId, maxResults = 12) {
  // Check Supabase cache first
  try {
    const { data } = await sb.from('creator_cache')
      .select('videos, cached_at')
      .eq('channel_id', channelId)
      .single();
    if (data) {
      const age = Date.now() - new Date(data.cached_at).getTime();
      if (age < 6 * 60 * 60 * 1000) { // 6 hours
        return data.videos;
      }
    }
  } catch(e) {}
 
  // Fetch from API
  const items = await ytSearch('', {
    channelId,
    order: 'date',
    maxResults,
  });
 
  // Store in Supabase cache
  try {
    await sb.from('creator_cache').upsert({
      channel_id: channelId,
      videos: items,
      cached_at: new Date().toISOString(),
    });
  } catch(e) {}
 
  return items;
}
 
function videoToMoteItem(v) {
  const mins = Math.round(parseDuration(v.contentDetails?.duration));
  return {
    id:              v.id,
    title:           v.snippet?.title || '',
    creator:         v.snippet?.channelTitle || '',
    channel_id:      v.snippet?.channelId || '',
    duration_label:  `${mins}m`,
    duration_bucket: durationBucket(mins),
    category:        v.snippet?.categoryId || '',
    yt_id:           v.id,
    moods:           [], // assigned by mood context
    intensity:       '2',
    tags:            v.snippet?.tags?.slice(0,5) || [],
    view_count:      parseInt(v.statistics?.viewCount || 0),
    source:          'api',
  };
}
 
// ─── MOOD SCORE — for sorting search results ──────────────────
const MOOD_KEYWORDS = {
  joy:          ['joy','celebration','happy','delight','beautiful','uplifting','wonderful','funny','wholesome','inspiring','love','warmth'],
  trust:        ['community','tradition','craft','calm','peaceful','belonging','honest','reliable','restore','gentle','quiet','process'],
  fear:         ['threat','danger','risk','crisis','warning','surveillance','collapse','pandemic','existential','exposed','vulnerable','dread'],
  surprise:     ['surprising','unexpected','counterintuitive','mind-blowing','paradox','mystery','strange','weird','astonishing','revealed','actually'],
  sadness:      ['grief','loss','tribute','memorial','heartfelt','loneliness','melancholy','mourning','farewell','difficult','moving','tender'],
  disgust:      ['corruption','injustice','exploitation','wrongdoing','failure','scandal','exposed','accountability','loathing','revolting','abuse'],
  anger:        ['injustice','inequality','protest','rights','outrage','systemic','oppression','discrimination','rage','fury','anger','unfair'],
  anticipation: ['future','innovation','breakthrough','discovery','next','emerging','possibility','potential','adventure','anticipate','coming','explore'],
  // Legacy
  unsettled: ['injustice','corruption','expose','truth','crisis','inequality'],
  moved: ['emotional','moving','heartfelt','grief','love','kindness'],
  transcendent: ['awe','breathtaking','universe','cosmos','wonder','beauty'],
  energized: ['incredible','triumph','achievement','record','breakthrough'],
  intellectually_active: ['explained','science','philosophy','history','how','why'],
  settled: ['calming','peaceful','meditation','slow','relaxing','nature'],
  contemplative: ['reflection','memory','nostalgia','meaning','identity','essay'],
};
 
// Sentiment signals that strongly indicate mood regardless of topic
const SENTIMENT_BOOSTS = {
  unsettled:   [/\bloss\b/i, /defeat/i, /\bfailed?\b/i, /tragedy/i, /scandal/i, /controversy/i, /\bdark\b/i, /heartbreak/i, /choke/i, /blown it/i, /what went wrong/i, /why did/i],
  energized:   [/champion/i, /\bwin\b/i, /\bwon\b/i, /victory/i, /dominant/i, /comeback/i, /clutch/i, /celebration/i, /parade/i, /\bepic\b/i, /greatest/i, /historic/i, /dynasty/i],
  contemplative:[/years later/i, /legacy/i, /what it means/i, /looking back/i, /retrospective/i, /impact/i, /remember/i],
};
 
function moodScore(item, mood) {
  if (!mood) return 0;
  const text = `${item.title} ${(item.tags||[]).join(' ')}`.toLowerCase();
  
  // Keyword score
  const keywords = MOOD_KEYWORDS[mood] || [];
  let score = keywords.filter(k => text.includes(k)).length;
  
  // Sentiment boost — strong signal words score higher
  const boosts = SENTIMENT_BOOSTS[mood] || [];
  score += boosts.filter(r => r.test(text)).length * 2;
  
  return score;
}
 
function sortByMood(items, mood) {
  if (!mood) return items;
  return [...items].sort((a, b) => moodScore(b, mood) - moodScore(a, mood));
}
 
// ─── HYBRID COMMONS POOL ──────────────────────────────────────
async function getLivePool(mood, intention) {
  // Static library pool
  const staticPool = getStaticPool(mood, intention);
 
  try {
    // Pick a random query for this mood
    const queries = MOOD_QUERIES[mood] || MOOD_QUERIES.intellectually_active;
    const query = queries[Math.floor(Math.random() * queries.length)];
    const apiItems = await ytSearch(query, { maxResults: 20 });
 
    // Tag API items with current mood
    apiItems.forEach(item => { item.moods = [mood]; });
 
    // Merge — static first for quality floor, API fills volume
    const allIds = new Set(staticPool.map(i => i.yt_id));
    const freshApi = apiItems.filter(i => !allIds.has(i.yt_id));
 
    return [...staticPool, ...freshApi];
  } catch(e) {
    console.warn('API search failed, falling back to static:', e);
    return staticPool;
  }
}
 
function getStaticPool(mood, intention) {
  if (!CONTENT?.length) return [];
  let pool;
  const activeMoods = currentMixedMoods.length > 0 ? currentMixedMoods : [mood];
  const primary = activeMoods[0];
 
  if (intention === 'different') {
    const opp = MOOD_OPPOSITES[primary] || 'settled';
    pool = CONTENT.filter(c => c.moods?.includes(opp) && !activeMoods.some(m => c.moods?.includes(m)));
    if (pool.length < 3) pool = CONTENT.filter(c => !activeMoods.some(m => c.moods?.includes(m)));
  } else if (intention === 'meets') {
    if (activeMoods.length > 1) {
      const scored = new Map();
      activeMoods.forEach((m, idx) => {
        const weight = activeMoods.length - idx;
        CONTENT.filter(c => c.moods?.includes(m)).forEach(c => {
          scored.set(c.id, (scored.get(c.id)||0) + weight);
        });
      });
      pool = CONTENT.filter(c => scored.has(c.id));
      pool.sort((a,b) => (scored.get(b.id)||0) - (scored.get(a.id)||0));
    } else {
      pool = CONTENT.filter(c => c.moods?.includes(primary));
    }
  } else if (intention === 'breathe') {
    pool = CONTENT.filter(c => c.intensity === '1');
  } else if (intention === 'through' || intention === 'challenges') {
    pool = CONTENT.filter(c => ['2','3'].includes(c.intensity));
  } else {
    pool = [...CONTENT];
  }
  if (pool.length < 2) pool = CONTENT.filter(c => c.moods?.includes(primary));
  return pool;
}
 
// ─── SEARCH ───────────────────────────────────────────────────
let currentSearchResults = [];
let searchMoodSorted = true;
 
async function runSearch(query) {
  if (!query.trim()) return;
  const el = document.getElementById('search-results-grid');
  if (el) el.innerHTML = '<p class="empty-state">Searching...</p>';
  go('screen-search');
 
  try {
    const results = await ytSearch(query, { maxResults: 25 });
    currentSearchResults = results;
    renderSearchResults(searchMoodSorted);
  } catch(e) {
    const el2 = document.getElementById('search-results-grid');
    if (el2) el2.innerHTML = '<p class="empty-state">Search unavailable. Check API key.</p>';
  }
}
 
function renderSearchResults(moodSort) {
  searchMoodSorted = moodSort;
  const el = document.getElementById('search-results-grid');
  if (!el) return;
  document.getElementById('sort-toggle-btn').textContent =
    moodSort ? 'Sort: mood context' : 'Sort: relevance';
 
  let results = [...currentSearchResults];
  if (moodSort && currentMood) results = sortByMood(results, currentMood);
 
  if (!results.length) {
    el.innerHTML = '<p class="empty-state">No results found.</p>';
    return;
  }
 
  el.innerHTML = '';
  results.slice(0, 12).forEach(item => {
    const card = document.createElement('button');
    card.className = 'content-card';
    card.onclick = () => {
      selectedContent = item;
      goWatch();
    };
    card.innerHTML = `
      <div class="thumb">
        <img src="https://img.youtube.com/vi/${item.yt_id}/mqdefault.jpg" alt=""
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          style="width:100%;height:100%;object-fit:cover;display:block;">
        <div class="thumb-placeholder" style="display:none"><div class="play-icon"></div></div>
      </div>
      <div style="flex:1;min-width:0;">
        <p class="card-title">${item.title}</p>
        <div class="card-detail">
          <span>${item.creator} · ${item.duration_label}</span>
          <span class="intensity-pill">${(item.view_count/1000).toFixed(0)}k views</span>
        </div>
      </div>`;
    el.appendChild(card);
  });
}
 
// ─── FOLLOWING ────────────────────────────────────────────────
let followedCreators = [];
 
async function loadFollows() {
  if (!currentUser) return;
  const { data } = await sb.from('follows')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('followed_at', { ascending: false });
  followedCreators = data || [];
  updateFollowButtons();
}
 
function isFollowing(channelId) {
  return followedCreators.some(f => f.channel_id === channelId);
}
 
function updateFollowButtons() {
  const channelId = selectedContent?.channel_id;
  if (!channelId) return;
  const following = isFollowing(channelId);
  document.querySelectorAll('.follow-btn').forEach(btn => {
    btn.textContent = following ? 'Following ✓' : '+ Follow';
    btn.style.color = following ? '#8a8278' : '#b0aaa2';
  });
}
 
async function toggleFollow() {
  if (!currentUser || !selectedContent?.channel_id) return;
  const channelId = selectedContent.channel_id;
  const channelName = selectedContent.creator;
 
  if (isFollowing(channelId)) {
    await sb.from('follows')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('channel_id', channelId);
    followedCreators = followedCreators.filter(f => f.channel_id !== channelId);
  } else {
    const { data } = await sb.from('follows').insert({
      user_id:       currentUser.id,
      channel_id:    channelId,
      channel_name:  channelName,
      channel_thumb: `https://img.youtube.com/vi/${selectedContent.yt_id}/default.jpg`,
    }).select().single();
    if (data) followedCreators.push(data);
  }
  updateFollowButtons();
}
 
async function renderFollowing() {
  const el = document.getElementById('following-content');
  if (!el) return;
  if (!followedCreators.length) {
    el.innerHTML = `<p style="font-size:0.85rem;color:#6a6458;font-style:italic;padding:2rem 0;">
      No followed creators yet. Follow a creator while watching to see their work here.</p>`;
    return;
  }
 
  el.innerHTML = '<p class="empty-state">Loading...</p>';
  const sections = [];
 
  for (const creator of followedCreators) {
    const videos = await ytChannelVideos(creator.channel_id, 6);
    if (!videos.length) continue;
    sections.push(`
      <div style="margin-bottom:2.5rem;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:1rem;">
          <p style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:#c8c2b8;">${creator.channel_name}</p>
          <button onclick="unfollowCreator('${creator.channel_id}')"
            style="background:none;border:none;font-size:0.65rem;color:#4a4840;cursor:pointer;letter-spacing:0.1em;text-transform:uppercase;font-family:'DM Sans',sans-serif;">
            Unfollow</button>
        </div>
        <div class="content-grid">
          ${videos.map(v => `
            <button class="content-card" onclick="selectAndWatch(${JSON.stringify(v).replace(/"/g,'&quot;')})">
              <div class="thumb">
                <img src="https://img.youtube.com/vi/${v.yt_id}/mqdefault.jpg" alt=""
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                  style="width:100%;height:100%;object-fit:cover;display:block;">
                <div class="thumb-placeholder" style="display:none"><div class="play-icon"></div></div>
              </div>
              <div style="flex:1;min-width:0;">
                <p class="card-title">${v.title}</p>
                <p class="card-detail">${v.duration_label}</p>
              </div>
            </button>`).join('')}
        </div>
      </div>`);
  }
 
  el.innerHTML = sections.join('') || '<p class="empty-state">No recent videos found.</p>';
}
 
async function unfollowCreator(channelId) {
  if (!currentUser) return;
  await sb.from('follows').delete()
    .eq('user_id', currentUser.id)
    .eq('channel_id', channelId);
  followedCreators = followedCreators.filter(f => f.channel_id !== channelId);
  renderFollowing();
}
 
function selectAndWatch(item) {
  selectedContent = item;
  goWatch();
}
