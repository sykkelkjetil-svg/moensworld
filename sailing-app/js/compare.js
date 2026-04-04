/**
 * compare.js
 * Renders the side-by-side comparison table for selected boats.
 */

// ── Field definitions ─────────────────────────────────────────
// Each entry: [rowLabel, fieldKey, unit, compareMode]
// compareMode: 'lower' = lower is better (speed handicap), 'higher' = higher is better,
//              null = no best/worst highlighting

const COMPARE_FIELDS = [
  ['Seilnummer',       'sailNo',       '',   null],
  ['Klasse',           'boatClass',    '',   null],
  ['Bygger',           'builder',      '',   null],
  ['Designer',         'designer',     '',   null],
  ['Årsmodell',        'year',         '',   null],
  ['LOA',              'loa',          'm',  'higher'],
  ['Bredde',           'beam',         'm',  'higher'],
  ['Dybgang',          'draft',        'm',  null],
  ['Deplasement',      'dspl',         'kg', null],
  ['GPH',              'gph',          '',   'lower'],
  ['OSN',              'osn',          '',   'higher'],
  ['TMF Innshore',     'tmfInshore',   '',   'higher'],
  ['TMF Offshore',     'tmfOffshore',  '',   'higher'],
  ['Seil hoved (m²)',  'areaMain',     'm²', 'higher'],
  ['Seil fok (m²)',    'areaJib',      'm²', 'higher'],
  ['Seil asym (m²)',   'areaAsym',     'm²', 'higher'],
  ['CDL',              'cdl',          '',   null],
];

// ── Public API ────────────────────────────────────────────────

export function renderCompareTable(boats) {
  const container = document.getElementById('compare-table-container');
  if (!container || boats.length === 0) return;

  const table = buildTable(boats);
  container.innerHTML = '';
  container.appendChild(table);
}

export function clearCompare() {
  const container = document.getElementById('compare-table-container');
  if (container) container.innerHTML = '';
}

// ── Table builder ─────────────────────────────────────────────

function buildTable(boats) {
  const table = document.createElement('table');
  table.className = 'compare-table';

  // Header row
  const thead = table.createTHead();
  const headRow = thead.insertRow();

  // First cell = empty label column header
  const thLabel = document.createElement('th');
  thLabel.textContent = 'Egenskap';
  headRow.appendChild(thLabel);

  boats.forEach(boat => {
    const th = document.createElement('th');
    th.innerHTML = `
      <div class="compare-boat-header">
        <span class="compare-boat-name">${esc(boat.name)}</span>
        <span class="compare-boat-class">${esc(boat.boatClass)}</span>
        <button class="btn-remove-compare" onclick="window._removeCompare('${boat.id}')">✕ Fjern</button>
      </div>`;
    headRow.appendChild(th);
  });

  // Body rows
  const tbody = table.createTBody();

  COMPARE_FIELDS.forEach(([label, field, unit, mode]) => {
    const values = boats.map(b => b[field]);
    const nums   = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

    let bestVal  = null;
    let worstVal = null;

    if (mode === 'lower' && nums.length > 1) {
      bestVal  = Math.min(...nums);
      worstVal = Math.max(...nums);
    } else if (mode === 'higher' && nums.length > 1) {
      bestVal  = Math.max(...nums);
      worstVal = Math.min(...nums);
    }

    const tr = tbody.insertRow();

    // Label cell
    const tdLabel = tr.insertCell();
    tdLabel.textContent = label;

    // Value cells
    boats.forEach(boat => {
      const td = tr.insertCell();
      const raw = boat[field];
      const num = parseFloat(raw);

      let display = formatValue(raw, unit);
      let cls = '';

      if (!isNaN(num) && nums.length > 1) {
        if (bestVal  !== null && num === bestVal)  cls = 'cell-best';
        if (worstVal !== null && num === worstVal) cls = 'cell-worst';
      }

      td.textContent = display;
      if (cls) td.className = cls;
    });
  });

  return table;
}

// ── Formatting ────────────────────────────────────────────────

function formatValue(val, unit) {
  if (val == null || val === '' || val === '—') return '—';
  const num = parseFloat(val);
  if (isNaN(num)) return String(val);

  let formatted;
  if (unit === 'm'  || unit === 'm²') formatted = num.toFixed(2);
  else if (unit === 'kg') formatted = num.toLocaleString('no');
  else if (Number.isInteger(num)) formatted = String(num);
  else formatted = num.toFixed(3);

  return unit ? `${formatted} ${unit}` : formatted;
}

// ── Escape ────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
