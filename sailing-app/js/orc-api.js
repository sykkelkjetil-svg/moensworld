/**
 * orc-api.js
 * Data layer for ORC certificate database (Norwegian boats / Norrating).
 *
 * Fetch priority:
 *  1. CORS proxy → live data from data.orc.org
 *  2. localStorage cache (24h TTL)
 *  3. Local mock file ./data/orc-mock-nor.json
 */

const ORC_URL  = 'https://data.orc.org/public/WPub.dll?action=DownRMS&CountryId=NOR&ext=json';
const PROXY    = 'https://corsproxy.io/?';
const CACHE_KEY = 'sailing_orc_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── Cache helpers ─────────────────────────────────────────────

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, boats } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return boats;
  } catch {
    return null;
  }
}

function writeCache(boats) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), boats }));
  } catch { /* quota exceeded – silently skip */ }
}

// ── Fetch with layered fallback ───────────────────────────────

/**
 * Returns boats immediately from cache or mock data (fast path),
 * then triggers a background refresh from the live ORC API.
 *
 * Callers receive data instantly; the live fetch updates the cache
 * silently for the next visit.
 *
 * Sets window.__orcDataSource to 'live', 'cache', or 'mock'.
 */
export async function fetchNorBoats() {
  // 1. Return from cache immediately if fresh (no waiting)
  const cached = readCache();
  if (cached && cached.length > 0) {
    window.__orcDataSource = 'cache';
    _refreshInBackground(); // update cache silently for next visit
    return cached;
  }

  // 2. Return mock data immediately so UI is never empty
  const mockBoats = await _loadMock();
  window.__orcDataSource = 'mock';
  _refreshInBackground(); // attempt live fetch in background
  return mockBoats;
}

/** Load the local mock JSON file (same origin – always fast). */
async function _loadMock() {
  try {
    const res  = await fetch('./data/orc-mock-nor.json');
    const json = await res.json();
    return json.rms || [];
  } catch {
    return [];
  }
}

/**
 * Fire-and-forget: try the CORS proxy and, if successful,
 * update the localStorage cache. Does NOT throw or block anything.
 */
function _refreshInBackground() {
  // Build an AbortSignal with 5s timeout (polyfilled for older browsers)
  let signal;
  try {
    signal = AbortSignal.timeout(5000);
  } catch {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    signal = ctrl.signal;
  }

  fetch(PROXY + encodeURIComponent(ORC_URL), { signal })
    .then(res => {
      if (!res.ok) return;
      return res.json();
    })
    .then(json => {
      const boats = json?.rms || [];
      if (boats.length > 0) {
        writeCache(boats);
        // Notify the UI if it wants to refresh (optional hook)
        window.__orcDataSource = 'live';
        if (typeof window.__onOrcRefresh === 'function') {
          window.__onOrcRefresh(boats);
        }
      }
    })
    .catch(() => { /* background refresh failed silently */ });
}

// ── Normalisation ─────────────────────────────────────────────

/**
 * Maps raw ORC API fields to a clean internal schema.
 * Works identically for live data and mock data.
 */
export function normalizeBoat(raw) {
  return {
    id:           raw.RefNo   || `raw-${Math.random()}`,
    certNo:       raw.CertNo  || '—',
    sailNo:       raw.SailNo  || '—',
    name:         raw.YachtName || 'Ukjent',
    boatClass:    raw.Class   || '—',
    builder:      raw.Builder || '—',
    designer:     raw.Designer || '—',
    year:         raw.Age_Year || null,
    loa:          toFloat(raw.LOA),
    beam:         toFloat(raw.MB),
    draft:        toFloat(raw.Draft),
    dspl:         toInt(raw.Dspl_Sailing),
    gph:          toFloat(raw.GPH),
    osn:          toFloat(raw.OSN),
    tmfInshore:   toFloat(raw.TMF_Inshore),
    tmfOffshore:  toFloat(raw.TMF_Offshore),
    areaMain:     toFloat(raw.Area_Main),
    areaJib:      toFloat(raw.Area_Jib),
    areaAsym:     toFloat(raw.Area_Asym),
    cdl:          toFloat(raw.CDL),
    isUserAdded:  false,
    notes:        '',
  };
}

function toFloat(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function toInt(v)   { const n = parseInt(v, 10);  return isNaN(n) ? null : n; }

// ── Search / filter helpers ───────────────────────────────────

/**
 * Case-insensitive substring search across name, sailNo, class, builder.
 */
export function searchBoats(query, boats) {
  if (!query) return boats;
  const q = query.toLowerCase();
  return boats.filter(b =>
    (b.name      || '').toLowerCase().includes(q) ||
    (b.sailNo    || '').toLowerCase().includes(q) ||
    (b.boatClass || '').toLowerCase().includes(q) ||
    (b.builder   || '').toLowerCase().includes(q)
  );
}

/**
 * Filter by boat class. Pass '' or 'alle' to return all.
 */
export function filterByClass(cls, boats) {
  if (!cls || cls === 'alle') return boats;
  return boats.filter(b => b.boatClass === cls);
}

/**
 * Returns sorted unique class names from a boat array.
 */
export function getUniqueClasses(boats) {
  const classes = boats.map(b => b.boatClass).filter(Boolean);
  return [...new Set(classes)].sort();
}

/**
 * Find a single boat by id (RefNo or user-generated id).
 */
export function getBoatById(id, boats) {
  return boats.find(b => b.id === id) || null;
}
