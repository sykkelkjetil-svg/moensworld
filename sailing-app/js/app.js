/**
 * app.js
 * Main orchestration: navigation, scroll-spy, lazy section init, news, toasts.
 */

import {
  initBoats, openAddBoatModal, closeAddBoatModal,
  saveUserBoat, openCompareOverlay, clearAllCompare
} from './boats.js';

// ── DOM ready ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initScrollSpy();
  initLazySections();
  renderNews();
  initInstrumentFrame();
  exposeGlobals();
});

// ── Navigation ────────────────────────────────────────────────

function initNav() {
  // Smooth-scroll nav links
  document.querySelectorAll('[data-nav-link]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth' });
      closeDrawer();
    });
  });

  // Hamburger
  const hamburger = document.getElementById('nav-hamburger');
  const drawer    = document.getElementById('nav-drawer');

  hamburger?.addEventListener('click', () => {
    drawer?.classList.toggle('open');
  });

  // Close drawer on outside click
  document.addEventListener('click', e => {
    if (drawer?.classList.contains('open') &&
        !drawer.contains(e.target) &&
        !hamburger?.contains(e.target)) {
      closeDrawer();
    }
  });
}

function closeDrawer() {
  document.getElementById('nav-drawer')?.classList.remove('open');
}

// ── Scroll spy ────────────────────────────────────────────────

function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('[data-nav-link]');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          const isActive = link.getAttribute('href') === `#${id}`;
          link.classList.toggle('active', isActive);
        });
      }
    });
  }, { rootMargin: `-${60}px 0px -60% 0px`, threshold: 0 });

  sections.forEach(s => obs.observe(s));
}

// ── Lazy section init ─────────────────────────────────────────

const initiated = new Set();

function initLazySections() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      if (initiated.has(id)) return;
      initiated.add(id);

      if (id === 'baater') initBoats();
    });
  }, { rootMargin: '200px', threshold: 0 });

  document.querySelectorAll('section[id]').forEach(s => obs.observe(s));
}

// ── Instrument iframe ─────────────────────────────────────────

function initInstrumentFrame() {
  const iframe  = document.getElementById('instrument-iframe');
  const loading = document.getElementById('instrument-loading');
  if (!iframe) return;

  // Use a flag instead of checking iframe.src (which returns the page URL
  // in some browsers when no src attribute is set, causing a reload loop).
  let iframeLoaded = false;

  iframe.addEventListener('load', () => {
    loading?.classList.add('hidden');
  });

  const loadIframe = () => {
    if (iframeLoaded) return;
    iframeLoaded = true;
    iframe.src = 'sailing-app-kopi.html';
  };

  // Trigger load when the instruments section first enters view
  const section = document.getElementById('instruments');
  if (!section) { loadIframe(); return; }

  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      loadIframe();
      obs.disconnect();
    }
  }, { threshold: 0.05 });

  obs.observe(section);
}

// ── News ──────────────────────────────────────────────────────

const NEWS_ITEMS = [
  {
    emoji: '🏆',
    source: 'Seilforbundet',
    date: '15. mars 2026',
    title: 'NM i offshore: Påmelding åpen',
    excerpt: 'Norges Seilforbund har åpnet påmelding til årets Norgesmesterskap i offshore-seiling. Regattaen går fra Bergen til Shetland.',
    url: 'https://www.seilforbundet.no',
  },
  {
    emoji: '🌊',
    source: 'Seiling.no',
    date: '12. mars 2026',
    title: 'Oslofjord Race 2026 – Full fart',
    excerpt: 'Over 120 båter er påmeldt årets Oslofjord Race. Nytt rekordantall deltagere fra Danmark og Sverige.',
    url: 'https://www.seiling.no',
  },
  {
    emoji: '⚡',
    source: 'World Sailing',
    date: '10. mars 2026',
    title: 'Norsk seiler til OL-finale',
    excerpt: 'Hermann Tomasgaard sikrer seg OL-plass etter sterke resultater i kvalikregattaen i Marseille.',
    url: 'https://www.sailing.org',
  },
  {
    emoji: '🛥️',
    source: 'Båtmagasinet',
    date: '8. mars 2026',
    title: 'Test: Jeanneau Sun Fast 3300',
    excerpt: 'Vi har testet en av de mest omtalte racer-cruiserne. Imponerende ytelse og overraskende komfort.',
    url: 'https://www.baatmagasinet.no',
  },
  {
    emoji: '📡',
    source: 'Meteorologisk',
    date: '6. mars 2026',
    title: 'Vårens første stabile vindperiode',
    excerpt: 'Yr.no melder om stabile og gode seilforhold langs kysten i perioden fra 20. mars. Nordvestlig bris 8–12 m/s.',
    url: 'https://www.yr.no',
  },
  {
    emoji: '🗺️',
    source: 'Kartverket',
    date: '1. mars 2026',
    title: 'Nye sjøkart: Oppdatert dybdedata',
    excerpt: 'Kartverket publiserer oppdaterte sjøkart for Vestlandet med ny dybdeinformasjon fra multistråle-sonar-kartlegging.',
    url: 'https://www.kartverket.no',
  },
];

function renderNews() {
  const grid = document.getElementById('news-grid');
  if (!grid) return;
  grid.innerHTML = NEWS_ITEMS.map(n => `
    <article class="news-card">
      <div class="news-card-img">${n.emoji}</div>
      <div class="news-card-body">
        <div class="news-meta">
          <span class="news-source">${esc(n.source)}</span>
          <span>${esc(n.date)}</span>
        </div>
        <div class="news-title">${esc(n.title)}</div>
        <div class="news-excerpt">${esc(n.excerpt)}</div>
        <a class="news-link" href="${n.url}" target="_blank" rel="noopener">
          Les mer
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </article>`).join('');
}

// ── Toast system ──────────────────────────────────────────────

window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// ── Expose global handlers (called from HTML onclick) ─────────

function exposeGlobals() {
  window.openAddBoatModal  = openAddBoatModal;
  window.closeAddBoatModal = closeAddBoatModal;
  window.saveUserBoat      = saveUserBoat;
  window.openCompareOverlay = openCompareOverlay;
  window.clearAllCompare   = clearAllCompare;

  window.closeCompareOverlay = () => {
    document.getElementById('compare-overlay')?.classList.add('hidden');
  };
}

// ── Escape ────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
