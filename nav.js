(function () {
  const NAV_H = 44;

  const LINKS = [
    { href: "/",                    icon: "◈",  label: "moensworld", home: true },
    { href: "/bikefit.html",        icon: "🚴", label: "BikeFit" },
    { href: "/skagen-race/",        icon: "🏆", label: "Skagen Race" },
    { href: "/vaerkart.html",       icon: "⛅", label: "Norsk Vær" },
    { href: "/sailing-app/",        icon: "⛵", label: "Seilinstrument" },
    { href: "/seiling/",            icon: "⛵", label: "Sammenligning" },
    { href: "/kystvaer/",           icon: "🌊", label: "Kystværet" },
    { href: "/vindstatistikk.html", icon: "📊", label: "Vindstatistikk" },
  ];

  // Detect current page
  const path = location.pathname.replace(/\/$/, "") || "/";
  function isCurrent(href) {
    const h = href.replace(/\/$/, "") || "/";
    return path === h || (h !== "/" && path.startsWith(h));
  }

  const style = document.createElement("style");
  style.textContent = `
    #mw-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      height: ${NAV_H}px;
      background: rgba(9,9,15,0.88);
      backdrop-filter: blur(14px) saturate(1.4);
      -webkit-backdrop-filter: blur(14px) saturate(1.4);
      border-bottom: 1px solid rgba(255,255,255,0.07);
      display: flex; align-items: center;
      padding: 0 16px; gap: 0;
      overflow-x: auto; overflow-y: hidden;
      scrollbar-width: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    #mw-nav::-webkit-scrollbar { display: none; }
    #mw-nav a {
      display: flex; align-items: center; gap: 5px;
      white-space: nowrap; text-decoration: none;
      font-size: 13px; font-weight: 500;
      padding: 6px 11px; border-radius: 8px;
      color: rgba(255,255,255,0.45);
      transition: color .15s, background .15s;
      flex-shrink: 0;
    }
    #mw-nav a:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.07); }
    #mw-nav a.mw-home {
      font-weight: 800; font-size: 14px; letter-spacing: -0.4px;
      color: #fff; margin-right: 4px; padding-left: 4px;
    }
    #mw-nav a.mw-home .mw-dot { color: #6c63ff; }
    #mw-nav a.mw-active {
      color: rgba(255,255,255,0.92); background: rgba(255,255,255,0.09);
    }
    #mw-nav .mw-sep {
      width: 1px; height: 18px; background: rgba(255,255,255,0.1);
      flex-shrink: 0; margin: 0 4px;
    }
    #mw-nav-spacer { height: ${NAV_H}px; }
  `;
  document.head.appendChild(style);

  const nav = document.createElement("nav");
  nav.id = "mw-nav";
  nav.setAttribute("aria-label", "moensworld navigasjon");

  LINKS.forEach((link, i) => {
    if (i === 1) {
      const sep = document.createElement("div");
      sep.className = "mw-sep";
      nav.appendChild(sep);
    }
    const a = document.createElement("a");
    a.href = link.href;
    if (link.home) {
      a.className = "mw-home";
      a.innerHTML = `moens<span class="mw-dot">world</span>`;
    } else {
      a.textContent = `${link.icon} ${link.label}`;
      if (isCurrent(link.href)) a.classList.add("mw-active");
    }
    nav.appendChild(a);
  });

  // Insert nav before body content
  function inject() {
    document.body.insertBefore(nav, document.body.firstChild);
    // Push content down — only if no spacer yet
    if (!document.getElementById("mw-nav-spacer")) {
      const spacer = document.createElement("div");
      spacer.id = "mw-nav-spacer";
      document.body.insertBefore(spacer, nav.nextSibling);
    }
  }

  if (document.body) { inject(); }
  else { document.addEventListener("DOMContentLoaded", inject); }
})();
