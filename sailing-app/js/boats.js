/**
 * boats.js
 * Handles the Båtoppslagsverk (Boat Encyclopedia) section.
 *
 * Fixes applied:
 *  - Event delegation (one listener on the grid, not N per card)
 *  - Lazy detail rendering (detail HTML only built when first opened)
 *  - Pagination (PAGE_SIZE boats at a time, "Last inn flere" button)
 */

import {
  fetchNorBoats, normalizeBoat,
  searchBoats, filterByClass, getUniqueClasses
} from './orc-api.js';
import { renderCompareTable, clearCompare as clearCompareTable } from './compare.js';

// ── State ─────────────────────────────────────────────────────

let allBoats      = [];
let filteredBoats = [];
export const compareSet = new Set();

const PAGE_SIZE       = 20;
let   currentPage     = 1;   // how many pages are currently shown

const USER_BOATS_KEY  = 'sailing_user_boats';
const COMPARE_SET_KEY = 'sailing_compare_set';

// ── Init ──────────────────────────────────────────────────────

let initialized = false;

export async function initBoats() {
  if (initialized) return;
  initialized = true;

  showSkeletons();

  const rawBoats = await fetchNorBoats();
  const orcBoats = rawBoats.map(normalizeBoat);
  const userBoats = loadUserBoats();
  allBoats = [...orcBoats, ...userBoats];
  filteredBoats = allBoats;

  // Restore compare selections
  const saved = JSON.parse(localStorage.getItem(COMPARE_SET_KEY) || '[]');
  saved.forEach(id => { if (allBoats.find(b => b.id === id)) compareSet.add(id); });

  populateClassFilter();
  updateDataSourceBadge();
  currentPage = 1;
  renderBoatGrid();
  if (compareSet.size > 0) updateCompareBar();

  // Single delegated listener on the grid  ← key fix
  const grid = document.getElementById('boat-grid');
  if (grid) grid.addEventListener('click', handleGridClick);

  // Search + filter
  document.getElementById('boat-search')
    ?.addEventListener('input', debounce(handleSearch, 300));
  document.getElementById('boat-class-filter')
    ?.addEventListener('change', handleFilterChange);

  // Background ORC refresh hook
  window.__onOrcRefresh = (freshRaw) => {
    const freshBoats = freshRaw.map(normalizeBoat);
    allBoats = [...freshBoats, ...loadUserBoats()];
    filteredBoats = allBoats;
    populateClassFilter();
    updateDataSourceBadge();
    currentPage = 1;
    renderBoatGrid();
    showToast('Båtdata oppdatert fra ORC', 'success');
  };
}

// ── Event delegation ──────────────────────────────────────────

function handleGridClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id     = btn.dataset.id;

  if (action === 'detail')   toggleDetail(id);
  if (action === 'compare')  toggleCompare(id);
  if (action === 'delete')   deleteUserBoat(id);
  if (action === 'loadmore') loadMore();
}

// ── Rendering ─────────────────────────────────────────────────

function showSkeletons() {
  const grid = document.getElementById('boat-grid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="skeleton-card">
      <div class="skeleton-line wide"></div>
      <div class="skeleton-line mid"></div>
      <div class="skeleton-line tall"></div>
      <div class="skeleton-line short"></div>
    </div>`).join('');
}

/**
 * Renders the current page of filteredBoats into the grid.
 * Does NOT attach per-card listeners – handled by delegation above.
 */
function renderBoatGrid() {
  const grid = document.getElementById('boat-grid');
  if (!grid) return;

  const countEl = document.getElementById('boat-count');
  if (countEl) countEl.textContent = filteredBoats.length;

  if (filteredBoats.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        Ingen båter funnet.<br>
        <small>Prøv et annet søk eller legg til en båt manuelt.</small>
      </div>`;
    return;
  }

  const visible = filteredBoats.slice(0, currentPage * PAGE_SIZE);
  const hasMore = visible.length < filteredBoats.length;

  grid.innerHTML =
    visible.map(boatCardHTML).join('') +
    (hasMore ? loadMoreHTML(filteredBoats.length - visible.length) : '');
}

function loadMore() {
  currentPage += 1;
  renderBoatGrid();
}

function loadMoreHTML(remaining) {
  return `
    <div class="empty-state" style="padding:24px">
      <button class="btn-primary" data-action="loadmore"
              style="margin:0 auto;display:flex">
        Last inn ${Math.min(remaining, PAGE_SIZE)} til
        (${remaining} gjenstår)
      </button>
    </div>`;
}

// ── Card HTML (no inline detail, no inline listeners) ─────────

function boatCardHTML(boat) {
  const userBadge = boat.isUserAdded ? '<span class="tag user">Manuell</span>' : '';
  const deleteBtn = boat.isUserAdded
    ? `<button class="btn-delete-boat" data-action="delete" data-id="${boat.id}" title="Slett">🗑</button>`
    : '';

  const loa   = boat.loa   != null ? `${boat.loa.toFixed(2)} m`   : '—';
  const beam  = boat.beam  != null ? `${boat.beam.toFixed(2)} m`  : '—';
  const draft = boat.draft != null ? `${boat.draft.toFixed(2)} m` : '—';
  const gph   = boat.gph   != null ? boat.gph.toFixed(1)          : '—';

  const compareSelected = compareSet.has(boat.id);
  const compareBtnCls   = compareSelected ? 'btn-compare-toggle selected' : 'btn-compare-toggle';
  const compareBtnTxt   = compareSelected ? '✓ Valgt' : '+ Sammenlign';

  return `
    <div class="boat-card" data-id="${boat.id}">
      <div class="boat-header">
        <div class="boat-name">${esc(boat.name)}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          ${userBadge}
          <span class="tag">${esc(boat.sailNo)}</span>
        </div>
      </div>

      <div class="boat-meta">
        <span class="tag accent">${esc(boat.boatClass)}</span>
        ${boat.year ? `<span class="tag">${boat.year}</span>` : ''}
        ${boat.builder && boat.builder !== '—' ? `<span class="tag">${esc(boat.builder)}</span>` : ''}
      </div>

      <div class="boat-specs">
        <div class="spec-item">
          <span class="spec-label">LOA</span>
          <span class="spec-value">${loa}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Bredde</span>
          <span class="spec-value">${beam}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Dybgang</span>
          <span class="spec-value">${draft}</span>
        </div>
      </div>

      <div class="boat-gph">
        <span>GPH (Norrating)</span>
        <strong>${gph}</strong>
      </div>

      <div class="boat-actions">
        <button class="btn-detail"
                data-action="detail" data-id="${boat.id}">Detaljer ▾</button>
        <button class="${compareBtnCls}"
                data-action="compare" data-id="${boat.id}">${compareBtnTxt}</button>
        ${deleteBtn}
      </div>

      <!-- Detail row: empty until first opened (lazy) -->
      <div class="boat-detail-row" id="detail-${boat.id}"></div>
    </div>`;
}

// ── Detail row (lazy-rendered on first open) ──────────────────

function toggleDetail(id) {
  const row = document.getElementById(`detail-${id}`);
  const btn = document.querySelector(`.btn-detail[data-id="${id}"]`);
  if (!row) return;

  // Build content the very first time
  if (!row.dataset.loaded) {
    const boat = allBoats.find(b => b.id === id);
    if (boat) row.innerHTML = boatDetailHTML(boat);
    row.dataset.loaded = '1';
  }

  const open = row.classList.toggle('open');
  if (btn) btn.textContent = open ? 'Detaljer ▴' : 'Detaljer ▾';
}

function boatDetailHTML(boat) {
  const rows = [
    ['Designer',        boat.designer],
    ['Deplasement',     boat.dspl != null ? `${boat.dspl.toLocaleString('no')} kg` : null],
    ['OSN',             boat.osn  != null ? boat.osn.toFixed(3)          : null],
    ['TMF Innshore',    boat.tmfInshore  != null ? boat.tmfInshore.toFixed(3)  : null],
    ['TMF Offshore',    boat.tmfOffshore != null ? boat.tmfOffshore.toFixed(3) : null],
    ['Seil hoved (m²)', boat.areaMain != null ? boat.areaMain.toFixed(1) : null],
    ['Seil fok (m²)',   boat.areaJib  != null ? boat.areaJib.toFixed(1)  : null],
    ['Seil asym (m²)',  boat.areaAsym != null ? boat.areaAsym.toFixed(1) : null],
    ['CDL',             boat.cdl  != null ? boat.cdl.toFixed(1) : null],
    ['Sert.nr.',        boat.certNo],
  ].filter(([, v]) => v && v !== '—');

  const half = Math.ceil(rows.length / 2);
  const renderCol = col => col.map(([label, val]) => `
    <div class="detail-item">
      <span class="dl">${label}</span>
      <span class="dv">${esc(String(val))}</span>
    </div>`).join('');

  const notesHtml = boat.isUserAdded && boat.notes
    ? `<div style="font-size:12px;color:var(--muted);padding-top:4px">${esc(boat.notes)}</div>`
    : '';

  return `
    <div class="detail-grid">
      <div>${renderCol(rows.slice(0, half))}</div>
      <div>${renderCol(rows.slice(half))}</div>
    </div>
    ${notesHtml}
    ${!boat.isUserAdded ? `
      <a class="cert-link"
         href="https://data.orc.org/public/WPub.dll?action=BoatCert&CertNo=${encodeURIComponent(boat.certNo)}&ext=html"
         target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        ORC sertifikat
      </a>` : ''}`;
}

// ── Compare logic ─────────────────────────────────────────────

export function toggleCompare(id) {
  if (compareSet.has(id)) {
    compareSet.delete(id);
  } else {
    if (compareSet.size >= 4) {
      showToast('Maks 4 båter kan sammenlignes', 'warn');
      return;
    }
    compareSet.add(id);
  }

  const selected = compareSet.has(id);
  const btn = document.querySelector(`.btn-compare-toggle[data-id="${id}"]`);
  if (btn) {
    btn.classList.toggle('selected', selected);
    btn.textContent = selected ? '✓ Valgt' : '+ Sammenlign';
  }

  saveCompareSet();
  updateCompareBar();
}

function updateCompareBar() {
  const bar = document.getElementById('compare-bar');
  if (!bar) return;

  if (compareSet.size === 0) {
    bar.classList.remove('visible');
    return;
  }

  bar.classList.add('visible');
  const countEl = bar.querySelector('.compare-bar-count');
  if (countEl) countEl.textContent = compareSet.size;

  const chipsEl = bar.querySelector('.compare-bar-boats');
  if (chipsEl) {
    const boats = [...compareSet]
      .map(id => allBoats.find(b => b.id === id))
      .filter(Boolean);
    chipsEl.innerHTML = boats.map(b => `
      <span class="compare-chip">
        ${esc(b.name)}
        <button onclick="window._removeCompare('${b.id}')" title="Fjern">×</button>
      </span>`).join('');
  }
}

window._removeCompare = function(id) {
  compareSet.delete(id);
  const btn = document.querySelector(`.btn-compare-toggle[data-id="${id}"]`);
  if (btn) { btn.classList.remove('selected'); btn.textContent = '+ Sammenlign'; }
  saveCompareSet();
  updateCompareBar();
  if (compareSet.size === 0) clearCompareTable();
};

export function openCompareOverlay() {
  if (compareSet.size < 2) {
    showToast('Velg minst 2 båter for å sammenligne', 'info');
    return;
  }
  const boats = [...compareSet].map(id => allBoats.find(b => b.id === id)).filter(Boolean);
  renderCompareTable(boats);
  document.getElementById('compare-overlay')?.classList.remove('hidden');
}

export function clearAllCompare() {
  compareSet.clear();
  saveCompareSet();
  updateCompareBar();
  clearCompareTable();
  document.getElementById('compare-overlay')?.classList.add('hidden');
  document.querySelectorAll('.btn-compare-toggle.selected').forEach(btn => {
    btn.classList.remove('selected');
    btn.textContent = '+ Sammenlign';
  });
}

function saveCompareSet() {
  localStorage.setItem(COMPARE_SET_KEY, JSON.stringify([...compareSet]));
}

// ── Search & Filter ───────────────────────────────────────────

function handleSearch() {
  applyFilters(
    (document.getElementById('boat-search')?.value || '').trim(),
    document.getElementById('boat-class-filter')?.value || 'alle'
  );
}

function handleFilterChange() {
  applyFilters(
    (document.getElementById('boat-search')?.value || '').trim(),
    document.getElementById('boat-class-filter')?.value || 'alle'
  );
}

function applyFilters(query, cls) {
  let result = allBoats;
  result = searchBoats(query, result);
  result = filterByClass(cls, result);
  filteredBoats = result;
  currentPage = 1;   // reset to first page on new filter
  renderBoatGrid();
}

function populateClassFilter() {
  const sel = document.getElementById('boat-class-filter');
  if (!sel) return;
  const currentVal = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  getUniqueClasses(allBoats).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
    sel.value = currentVal;
  }
}

// ── Add boat modal ────────────────────────────────────────────

export function openAddBoatModal() {
  document.getElementById('modal-add-boat')?.classList.remove('hidden');
  document.getElementById('add-boat-form')?.reset();
  setTimeout(() => document.getElementById('add-boat-name')?.focus(), 100);
}

export function closeAddBoatModal() {
  document.getElementById('modal-add-boat')?.classList.add('hidden');
}

export function saveUserBoat() {
  const name    = document.getElementById('add-boat-name')?.value.trim();
  const sailNo  = document.getElementById('add-boat-sailno')?.value.trim();
  const cls     = document.getElementById('add-boat-class')?.value.trim();
  const builder = document.getElementById('add-boat-builder')?.value.trim();
  const year    = parseInt(document.getElementById('add-boat-year')?.value)   || null;
  const loa     = parseFloat(document.getElementById('add-boat-loa')?.value)  || null;
  const beam    = parseFloat(document.getElementById('add-boat-beam')?.value) || null;
  const draft   = parseFloat(document.getElementById('add-boat-draft')?.value)|| null;
  const gph     = parseFloat(document.getElementById('add-boat-gph')?.value)  || null;
  const notes   = document.getElementById('add-boat-notes')?.value.trim() || '';

  if (!name) { showToast('Navn er påkrevd', 'error'); return; }

  const boat = {
    id: `user-${Date.now()}`,
    certNo: '—', sailNo: sailNo || '—', name,
    boatClass: cls || '—', builder: builder || '—', designer: '—',
    year, loa, beam, draft,
    dspl: null, gph,
    osn: null, tmfInshore: null, tmfOffshore: null,
    areaMain: null, areaJib: null, areaAsym: null, cdl: null,
    isUserAdded: true, notes,
  };

  const userBoats = loadUserBoats();
  userBoats.push(boat);
  saveUserBoats(userBoats);

  allBoats = [boat, ...allBoats];
  populateClassFilter();
  applyFilters(
    document.getElementById('boat-search')?.value || '',
    document.getElementById('boat-class-filter')?.value || 'alle'
  );
  closeAddBoatModal();
  showToast(`${name} lagt til!`, 'success');
}

function deleteUserBoat(id) {
  const boat = allBoats.find(b => b.id === id);
  if (!boat?.isUserAdded) return;
  if (!confirm(`Vil du slette "${boat.name}"?`)) return;

  saveUserBoats(loadUserBoats().filter(b => b.id !== id));
  allBoats = allBoats.filter(b => b.id !== id);
  compareSet.delete(id);
  saveCompareSet();
  updateCompareBar();
  applyFilters(
    document.getElementById('boat-search')?.value || '',
    document.getElementById('boat-class-filter')?.value || 'alle'
  );
  showToast(`${boat.name} slettet`, 'info');
}

// ── LocalStorage ──────────────────────────────────────────────

function loadUserBoats() {
  try { return JSON.parse(localStorage.getItem(USER_BOATS_KEY) || '[]'); }
  catch { return []; }
}
function saveUserBoats(boats) {
  localStorage.setItem(USER_BOATS_KEY, JSON.stringify(boats));
}

// ── UI helpers ────────────────────────────────────────────────

function updateDataSourceBadge() {
  const dot  = document.getElementById('data-source-dot');
  const text = document.getElementById('data-source-text');
  const map  = {
    live:  { cls: 'live',  label: 'Live fra ORC' },
    cache: { cls: 'cache', label: 'Bufret data (< 24t)' },
    mock:  { cls: 'mock',  label: 'Eksempeldata (offline)' },
  };
  const { cls, label } = map[window.__orcDataSource || 'mock'] || map.mock;
  if (dot)  dot.className  = `status-dot ${cls}`;
  if (text) text.textContent = label;
}

// ── Utilities ─────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '—')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function showToast(msg, type = 'info') {
  if (window.showToast) window.showToast(msg, type);
}
