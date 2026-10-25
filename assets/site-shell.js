(function () {
  const tvMode = new URLSearchParams(location.search).get('tv') === '1';
  if (tvMode) {
    document.documentElement.classList.add('tv-mode');
    if (!window.__cinemaTvRemoteBridge) {
      window.__cinemaTvRemoteBridge = true;
      const keyCodes = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13 };
      const visible = (el) => {
        if (!el || !el.getClientRects().length) return false;
        const style = getComputedStyle(el);
        return style.visibility !== 'hidden'
          && style.display !== 'none'
          && style.opacity !== '0'
          && style.pointerEvents !== 'none'
          && (el.offsetWidth > 0 || el.offsetHeight > 0);
      };
      const focusables = () => [...document.querySelectorAll('button,a,input,select,textarea,[tabindex="0"]')].filter(el => visible(el) && !el.disabled && el.getAttribute('tabindex') !== '-1');
      let contentReturn = null;
      const focusElement = (element) => {
        if (!element) return;
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      };
      const moveFocus = (key) => {
        // The home page already has its own row-aware navigator.
        if (document.querySelector('#rows-container')) return;
        const items = focusables();
        if (!items.length) return;
        const current = document.activeElement;
        if (!items.includes(current)) { items[0].focus(); return; }
        if (key === 'Enter') {
          current.click();
          if (current.matches('[data-shell-menu]')) {
            window.requestAnimationFrame(() => {
              const menu = document.getElementById(`shell-${current.dataset.shellMenu}`);
              const first = menu?.classList.contains('open') && [...menu.querySelectorAll('a,button')].find(visible);
              if (first) focusElement(first);
            });
          }
          return;
        }
        const openMenu = current.closest('.nav-submenu.open');
        if (openMenu && key === 'ArrowLeft') {
          const parent = document.querySelector(`[data-menu="${openMenu.id}"]`);
          if (parent && visible(parent)) focusElement(parent);
          return;
        }
        const rail = [...document.querySelectorAll('.cinema-shell-header .nav-link, .cinema-shell-header #favorites-nav, .cinema-shell-header #search-toggle')].filter(visible);
        const main = document.querySelector('main');
        const content = main ? [...main.querySelectorAll('a,button,input,select,textarea,[tabindex="0"]')].filter(el => visible(el) && !el.disabled && el.getAttribute('tabindex') !== '-1') : [];
        const railIndex = rail.indexOf(current);
        if (railIndex >= 0) {
          if (key === 'ArrowUp' || key === 'ArrowDown') {
            const next = railIndex + (key === 'ArrowUp' ? -1 : 1);
            if (rail[next]) focusElement(rail[next]);
            return;
          }
          if (key === 'ArrowRight') {
            const target = contentReturn && content.includes(contentReturn) ? contentReturn : content[0];
            if (target) focusElement(target);
            return;
          }
          return;
        }
        if (content.includes(current) && key === 'ArrowLeft' && main) {
          const mainRect = main.getBoundingClientRect();
          const currentRect = current.getBoundingClientRect();
          if (currentRect.left <= mainRect.left + 24) {
            contentReturn = current;
            if (rail[0]) focusElement(rail[0]);
            return;
          }
        }
        const from = current.getBoundingClientRect();
        const vertical = key === 'ArrowUp' || key === 'ArrowDown';
        const direction = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
        const candidates = items.filter(el => el !== current).map(el => ({ el, rect: el.getBoundingClientRect() })).filter(({ rect }) => {
          const dx = rect.left + rect.width / 2 - (from.left + from.width / 2);
          const dy = rect.top + rect.height / 2 - (from.top + from.height / 2);
          return vertical ? (direction < 0 ? dy < -8 : dy > 8) : (direction < 0 ? dx < -8 : dx > 8);
        });
        candidates.sort((a, b) => {
          const ac = vertical ? Math.abs(a.rect.top - from.top) + Math.abs(a.rect.left - from.left) * 2 : Math.abs(a.rect.left - from.left) + Math.abs(a.rect.top - from.top) * 2;
          const bc = vertical ? Math.abs(b.rect.top - from.top) + Math.abs(b.rect.left - from.left) * 2 : Math.abs(b.rect.left - from.left) + Math.abs(b.rect.top - from.top) * 2;
          return ac - bc;
        });
        candidates[0]?.el.focus({ preventScroll: true });
        candidates[0]?.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      };
      window.addEventListener('message', (event) => {
        const key = String(event.data?.type === 'cinema:remote-key' ? event.data.key : '');
        if (!keyCodes[key]) return;
        const target = document.activeElement || document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode: keyCodes[key], which: keyCodes[key], bubbles: true, cancelable: true }));
      });
      document.addEventListener('keydown', (event) => {
        if (!keyCodes[event.key] || document.querySelector('#rows-container')) return;
        event.preventDefault();
        moveFocus(event.key);
      }, true);
    }
  }
  if (document.querySelector('.cinema-shell-header')) return;
  const path = location.pathname;
  const match = path.match(/^(.*\/cinema-library)(?:\/|$)/i);
  const base = match ? `${location.origin}${match[1]}/` : new URL('./', location.href).href;
  const appUrl = (value) => new URL(value, base).href;
  const page = (path.split('/').pop() || 'index.html').toLowerCase();
  const isHome = page === 'index.html' || page === '';
  const query = new URLSearchParams(location.search);
  const catalogType = query.get('type');
  const active = page === 'catalog.html' && catalogType === 'movie' ? 'movies'
    : page === 'catalog.html' && catalogType === 'tv' ? 'series'
    : isHome && location.hash === '#favorites' ? 'favorites'
    : isHome ? 'home' : '';
  const menus = {
    movies: [['Toate filmele', 'catalog.html?type=movie'], ['Lansări recente', 'catalog.html?type=movie&sort=latest'], ['Cele mai apreciate', 'catalog.html?type=movie&sort=top']],
    series: [['Toate serialele', 'catalog.html?type=tv'], ['Seriale recente', 'catalog.html?type=tv&sort=latest'], ['Cele mai apreciate', 'catalog.html?type=tv&sort=top']],
    top: [['Top filme', 'catalog.html?mode=top&type=movie'], ['Top seriale', 'catalog.html?mode=top&type=tv']]
  };
  const nav = [['Home', 'index.html', 'home'], ['Movies', '', 'movies'], ['TV Shows', '', 'series']];
  document.documentElement.classList.add('cinema-shell-page');
  document.body.classList.add('cinema-shell-page');
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = appUrl('assets/site-shell.css?v=20261025-stability13'); document.head.append(css);
  const parityCss = document.createElement('link'); parityCss.rel = 'stylesheet'; parityCss.href = appUrl('assets/nav-parity.css?v=20261025-focus21'); document.head.append(parityCss);
  const main = document.querySelector('body>main');
  document.querySelectorAll('body>header,body>.top,body>footer').forEach((node) => node.remove());
  const navHtml = nav.map(([label, href, key]) => menus[key]
    ? `<div class="nav-dropdown"><button class="nav-link ${active === key ? 'active' : ''}" type="button" data-shell-menu="${key}" data-menu="shell-${key}" aria-current="${active === key ? 'page' : 'false'}" aria-expanded="false">${label}</button><div class="nav-submenu" id="shell-${key}">${menus[key].map(([text, target]) => `<a href="${target}">${text}</a>`).join('')}</div></div>`
    : `<a class="nav-link ${active === key ? 'active' : ''}" href="${href}" data-nav="${key}" aria-current="${active === key ? 'page' : 'false'}">${label}</a>`).join('');
  const header = document.createElement('header');
  header.className = 'cinema-shell-header';
  header.id = 'header';
  header.innerHTML = `<div class="logo" id="logo">Cinema Library</div><button class="home-mobile-menu mobile-nav-toggle" id="home-mobile-menu" type="button" aria-expanded="false" aria-controls="home-nav" aria-label="Deschide meniul">☰</button><nav class="nav-links" id="home-nav" aria-label="Main navigation">${navHtml}<button class="library-nav-btn${active === 'favorites' ? ' active' : ''}" id="favorites-nav" type="button" title="Open watchlist" aria-current="${active === 'favorites' ? 'page' : 'false'}">▣<span>Watchlist</span></button><div class="search-wrap" id="search-wrap"><button class="search-toggle" id="search-toggle" type="button" aria-label="Search" aria-expanded="false">⌕<span>Search</span></button><input id="search" type="text" placeholder="Search movies and series…" autocomplete="off"><button id="search-clear" type="button" aria-label="Clear">✕</button></div></nav>`;
  document.body.prepend(header);
  if (!isHome && main && !document.querySelector('.shell-hero')) {
    const hero = document.createElement('section'); hero.className = 'shell-hero'; hero.setAttribute('aria-label', 'Titluri populare');
    hero.innerHTML = '<div class="shell-hero-copy"><small>Cinema Library</small><h1>Filme și seriale pentru tine</h1><p>Descoperă titluri populare și găsește rapid următoarea vizionare.</p></div>';
    document.body.insertBefore(hero, main);
    const heroImages = ['7WsyChQLEftFiDOVTGkv3hFpyyt.jpg', '8cdWjvZQUExUUTzyp4t6EDMubfO.jpg', 'tmU7GeKVybMWFButWEGl2M4GeiP.jpg', 'q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg'];
    heroImages.forEach((image, index) => { const slide = document.createElement('div'); slide.className = `shell-hero-slide${index === 0 ? ' active' : ''}`; slide.dataset.bg = `https://image.tmdb.org/t/p/w1280/${image}`; hero.append(slide); });
    let slideIndex = 0;
    let heroTimer = 0;
    const loadHeroImage = (slide) => {
      if (!slide || slide.style.backgroundImage || !slide.dataset.bg) return;
      slide.style.backgroundImage = `url('${slide.dataset.bg}')`;
    };
    loadHeroImage(hero.querySelector('.shell-hero-slide.active'));
    const rotateHero = () => {
      if (document.hidden) return;
      const slides = hero.querySelectorAll('.shell-hero-slide');
      if (slides.length < 2) return;
      slides[slideIndex]?.classList.remove('active');
      slideIndex = (slideIndex + 1) % slides.length;
      loadHeroImage(slides[slideIndex]);
      slides[slideIndex]?.classList.add('active');
    };
    const startHeroRotation = () => {
      if (heroTimer || document.hidden) return;
      heroTimer = window.setInterval(rotateHero, 8000);
    };
    const stopHeroRotation = () => {
      if (!heroTimer) return;
      window.clearInterval(heroTimer);
      heroTimer = 0;
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopHeroRotation();
      else startHeroRotation();
    });
    startHeroRotation();
  }
  const footerMarkup = `<div class="footer-main"><div class="footer-links"><div><h3>Linkuri</h3><a href="catalog.html?type=movie">Filme</a><a href="catalog.html?type=tv">Seriale</a><a href="watch-together.html">Vezi împreună</a><a href="catalog.html?mode=top">Top IMDB</a></div><div><h3>Genuri</h3><a href="genres.html">Toate genurile</a><a href="catalog.html?type=movie&genre=28">Filme de acțiune</a><a href="catalog.html?type=movie&genre=27">Filme horror</a><a href="catalog.html?type=movie&genre=878">Filme SF</a><a href="catalog.html?type=movie&genre=53">Filme thriller</a></div><div><h3>Informații</h3><a href="contact.html">Contact</a><a href="terms.html">Termeni și condiții</a><a href="sitemap.html">Hartă site</a><a href="privacy.html">Confidențialitate</a></div></div><div class="footer-about"><h3>Despre noi</h3><p>Cinema Library este un catalog pentru filme și seriale, cu linkuri către servicii media terțe.</p><p>Nu stocăm fișiere video pe serverele noastre; disponibilitatea și subtitrările pot varia în funcție de sursă.</p><div class="footer-features"><span>♛ Calitate înaltă</span><span>▶ Gratuit, mereu</span><span>ϟ Încărcare rapidă</span><span>▣ Subtitrări multiple</span></div><div class="footer-downloads"><h3>Descarcă aplicația</h3><div class="download-grid"><a class="download-card" href="download.html?platform=desktop"><span class="download-icon">▣</span><span><strong>Desktop</strong><small>Windows · .exe</small></span><span class="download-arrow">↓</span></a><a class="download-card" href="download.html?platform=android"><span class="download-icon">▣</span><span><strong>Android</strong><small>APK · vezi releases</small></span><span class="download-arrow">↓</span></a><a class="download-card download-card-disabled" href="download.html?platform=ios"><span class="download-icon">●</span><span><strong>iOS</strong><small>Disponibil în curând</small></span></a></div></div></div></div><div class="footer-bottom"><span class="footer-copy">© 2026 Cinema Library</span><div class="footer-bottom-links"><a href="sitemap.html">Hartă site</a><a href="contact.html">Contact</a><a href="terms.html">Termeni și condiții</a><a href="privacy.html">Confidențialitate</a></div></div>`;
  const normalizeLinks = (root = document) => root.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || /^(?:[a-z]+:|\/\/|#)/i.test(href)) return;
    const target = new URL(href, base);
    // Keep TV mode when Home or another internal page is opened. Without
    // this, the new document briefly falls back to the small desktop skin.
    if (tvMode) target.searchParams.set('tv', '1');
    link.href = target.href;
  });
  const mountFooter = () => { document.querySelectorAll('body>footer').forEach((node) => node.remove()); const footer = document.createElement('footer'); footer.className = 'site-footer'; footer.innerHTML = footerMarkup; document.body.append(footer); normalizeLinks(footer); };
  if (main) mountFooter(); else document.addEventListener('DOMContentLoaded', mountFooter, { once: true });
  normalizeLinks(header);
  if (!isHome) {
  const theme = document.getElementById('theme-toggle');
  if (localStorage.getItem('cinemalibrary_theme') === 'light') document.documentElement.dataset.theme = 'light';
  if (theme) theme.onclick = () => { const light = document.documentElement.dataset.theme === 'light'; document.documentElement.dataset.theme = light ? '' : 'light'; localStorage.setItem('cinemalibrary_theme', light ? 'dark' : 'light'); };
  document.getElementById('favorites-nav').onclick = () => { location.href = appUrl('index.html#favorites'); };
  const search = document.getElementById('search');
  const searchWrap = document.getElementById('search-wrap');
  document.getElementById('search-toggle').onclick = () => { searchWrap.classList.add('search-open'); document.getElementById('search-toggle').setAttribute('aria-expanded', 'true'); search.focus(); };
  search.onkeydown = (event) => { if (event.key === 'Enter' && search.value.trim()) location.href = appUrl(`index.html?search=${encodeURIComponent(search.value.trim())}`); };
  document.getElementById('search-clear').onclick = () => { search.value = ''; search.focus(); };
  document.querySelectorAll('[data-shell-menu]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); const menu = document.getElementById(`shell-${button.dataset.shellMenu}`); document.querySelectorAll('.nav-submenu.open').forEach((item) => { if (item !== menu) item.classList.remove('open'); }); menu.classList.toggle('open'); }));
  document.addEventListener('click', () => document.querySelectorAll('.nav-submenu.open').forEach((item) => item.classList.remove('open')));
  const mobileToggle = document.getElementById('home-mobile-menu'), navElement = document.getElementById('home-nav'); mobileToggle.onclick = (event) => { event.stopPropagation(); const open = navElement.classList.toggle('mobile-open'); mobileToggle.setAttribute('aria-expanded', String(open)); }; navElement.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => navElement.classList.remove('mobile-open')));
  }

  // Search is part of the TFlix rail on every page, including the home page.
  // Bind it outside the non-home block so the visual rail remains functional.
  const shellSearch = document.getElementById('search');
  const shellSearchWrap = document.getElementById('search-wrap');
  const shellSearchToggle = document.getElementById('search-toggle');
  if (shellSearch && shellSearchWrap && shellSearchToggle && !shellSearchToggle.dataset.bound) {
    shellSearchToggle.dataset.bound = '1';
    shellSearchToggle.onclick = () => { shellSearchWrap.classList.add('search-open'); shellSearchToggle.setAttribute('aria-expanded', 'true'); shellSearch.focus(); };
    shellSearch.onkeydown = (event) => { if (event.key === 'Enter' && shellSearch.value.trim()) location.href = appUrl(`index.html?search=${encodeURIComponent(shellSearch.value.trim())}`); };
    document.getElementById('search-clear')?.addEventListener('click', () => { shellSearch.value = ''; shellSearch.focus(); });
  }

  // The home page uses the same injected rail, so its dropdowns and watchlist
  // must receive handlers too (the old code only wired secondary pages).
  if (isHome) {
    document.getElementById('favorites-nav')?.addEventListener('click', () => { location.href = appUrl('index.html#favorites'); });
    document.querySelectorAll('[data-shell-menu]').forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const menu = document.getElementById(`shell-${button.dataset.shellMenu}`);
        document.querySelectorAll('.nav-submenu.open').forEach((item) => { if (item !== menu) item.classList.remove('open'); });
        menu?.classList.toggle('open');
      });
    });
    if (!document.body.dataset.shellMenuCloseBound) {
      document.body.dataset.shellMenuCloseBound = '1';
      document.addEventListener('click', () => document.querySelectorAll('.nav-submenu.open').forEach((item) => item.classList.remove('open')));
    }
  }

  // Keep the semantic dropdown state in sync with the class toggled by the
  // handlers above. Samsung WebViews can use aria-expanded when deciding
  // whether the remote focus should remain inside a menu.
  const syncShellMenuState = () => document.querySelectorAll('[data-shell-menu]').forEach((button) => {
    const menu = document.getElementById(`shell-${button.dataset.shellMenu}`);
    button.setAttribute('aria-expanded', String(Boolean(menu?.classList.contains('open'))));
  });
  syncShellMenuState();
  document.querySelectorAll('.nav-submenu').forEach((menu) => {
    new MutationObserver(syncShellMenuState).observe(menu, { attributes: true, attributeFilter: ['class'] });
  });

  // Launch every direct stream link in the same Rioma fullscreen surface.
  // This keeps catalog, genres and watch-together consistent with the home
  // modal without navigating to a separate details/player page.
  function openRiomaFromLink(href) {
    let overlay = document.getElementById('rioma-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'rioma-overlay';
      overlay.className = 'rioma-overlay';
      overlay.hidden = true;
      overlay.innerHTML = '<iframe id="rioma-overlay-frame" title="Player Rioma" allowfullscreen allow="autoplay *; encrypted-media *; picture-in-picture *; fullscreen *; web-share *"></iframe>';
      document.body.append(overlay);
      const style = document.createElement('style');
      style.textContent = '.rioma-overlay{position:fixed;inset:0;z-index:10000;background:#000}.rioma-overlay[hidden]{display:none}.rioma-overlay iframe{display:block;width:100%;height:100%;border:0;background:#000}';
      document.head.append(style);
    }
    const frame = document.getElementById('rioma-overlay-frame');
    const destination = new URL(href, document.baseURI);
    destination.searchParams.set('embedded', '1');
    frame.src = destination.href;
    overlay.hidden = false;
    overlay.classList.add('open');
    const request = overlay.requestFullscreen || overlay.webkitRequestFullscreen;
    if (request) { try { Promise.resolve(request.call(overlay)).catch(() => {}); } catch {} }
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || link.target === '_blank') return;
    const url = new URL(link.href, document.baseURI);
    if (!/(?:^|\/)stream\/(?:index\.html)?$/i.test(url.pathname.replace(/\/$/, '/'))) return;
    event.preventDefault();
    openRiomaFromLink(url.href);
  });
})();

