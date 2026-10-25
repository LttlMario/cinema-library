(function () {
  function centerSearch() {
    const wrap = document.querySelector('#search-wrap');
    const input = document.querySelector('#search');
    const clear = document.querySelector('#search-clear');
    const suggestions = document.querySelector('#search-suggestions');
    if (!wrap || !input) return;

    // Keep the Search button in the sidebar. Only the floating field and its
    // related controls are moved to body, where they can use page coordinates.
    [input, clear, suggestions].forEach((element) => {
      if (element && element.parentElement !== document.body) document.body.appendChild(element);
    });

    const width = Math.min(420, Math.max(240, window.innerWidth * 0.6));
    input.style.setProperty('position', 'fixed', 'important');
    input.style.setProperty('left', '50%', 'important');
    input.style.setProperty('top', '14px', 'important');
    input.style.setProperty('right', 'auto', 'important');
    input.style.setProperty('bottom', 'auto', 'important');
    input.style.setProperty('transform', 'translateX(-50%)', 'important');
    input.style.setProperty('width', `${width}px`, 'important');
    input.style.height = '42px';
    input.style.setProperty('display', 'block', 'important');
    input.style.setProperty('opacity', '1', 'important');
    input.style.setProperty('pointer-events', 'auto', 'important');
    input.style.zIndex = '600';
    input.style.background = '#141419';
    input.style.color = '#f4f4f5';

    if (clear) {
      clear.style.setProperty('position', 'fixed', 'important');
      clear.style.setProperty('left', `calc(50% + ${width / 2 - 30}px)`, 'important');
      clear.style.setProperty('right', 'auto', 'important');
      clear.style.setProperty('top', '25px', 'important');
      clear.style.setProperty('bottom', 'auto', 'important');
      clear.style.zIndex = '601';
    }
    if (suggestions) {
      suggestions.style.setProperty('position', 'fixed', 'important');
      suggestions.style.setProperty('left', '50%', 'important');
      suggestions.style.setProperty('top', '64px', 'important');
      suggestions.style.setProperty('transform', 'translateX(-50%)', 'important');
      suggestions.style.setProperty('width', `${width}px`, 'important');
      suggestions.style.zIndex = '610';
    }
  }

  function setSearchA11yState(input, clear, open) {
    if (input) {
      input.setAttribute('aria-hidden', String(!open));
      input.tabIndex = open ? 0 : -1;
    }
    if (clear) {
      clear.setAttribute('aria-hidden', String(!open));
      clear.tabIndex = open ? 0 : -1;
    }
  }

  function bind() {
    // Remove the legacy auxiliary control if it was left in the DOM by a
    // cached/older navigation script. The sidebar keeps only the real toggle.
    document.querySelectorAll('#search-toggle-proxy').forEach((element) => element.remove());
    const header = document.querySelector('.cinema-shell-header, #header');
    if (!header || header.dataset.homeNavFix === '1') return;
    header.dataset.homeNavFix = '1';

    // The legacy home script also touches .nav-link.active. Restore the
    // page-level active state after it finishes, so it stays red.
    const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const currentType = new URLSearchParams(location.search).get('type');
    const activeKey = currentPage === 'catalog.html' && currentType === 'movie' ? 'movies'
      : currentPage === 'catalog.html' && currentType === 'tv' ? 'series'
      : (currentPage === 'index.html' || currentPage === '') && location.hash === '#favorites' ? 'favorites'
      : currentPage === 'index.html' || currentPage === '' ? 'home' : '';
    const restoreActive = () => {
      header.querySelectorAll('.nav-link').forEach((item) => {
        const shouldBeActive = header.id === 'header'
          ? (activeKey === 'home' && item.dataset.nav === 'home')
          : (activeKey === 'home'
            ? item.tagName === 'A' && (item.getAttribute('href') || '').endsWith('index.html')
            : item.dataset.shellMenu === activeKey);
        item.classList.toggle('active', shouldBeActive);
      });
      const favorites = header.querySelector('#favorites-nav');
      if (favorites) {
        const shouldBeActive = activeKey === 'favorites';
        favorites.classList.toggle('active', shouldBeActive);
        favorites.setAttribute('aria-current', shouldBeActive ? 'page' : 'false');
      }
    };
    restoreActive();
    [0, 250, 1000].forEach((delay) => setTimeout(restoreActive, delay));
    const activeObserver = new MutationObserver(restoreActive);
    activeObserver.observe(header, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pagehide', (event) => {
      if (!event.persisted) activeObserver.disconnect();
    }, { once: true });

    const pageBase = new URL('./', location.href);
    const tvMode = new URLSearchParams(location.search).get('tv') === '1';
    const go = (path) => {
      const target = new URL(path, pageBase);
      if (tvMode) target.searchParams.set('tv', '1');
      location.href = target.href;
    };

    const favorites = header.querySelector('#favorites-nav');
    if (favorites && !favorites.dataset.homeNavFixBound) {
      favorites.dataset.homeNavFixBound = '1';
      favorites.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        go('index.html#favorites');
      });
    }

    header.querySelectorAll('[data-shell-menu]').forEach((button) => {
      if (button.dataset.homeNavFixBound) return;
      button.dataset.homeNavFixBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = header.querySelector(`#shell-${button.dataset.shellMenu}`);
        if (!menu) return;
        header.querySelectorAll('.nav-submenu.open').forEach((item) => {
          if (item !== menu) item.classList.remove('open');
        });
        menu.classList.toggle('open');
      });
    });

    const searchToggle = header.querySelector('#search-toggle');
    const searchWrap = header.querySelector('#search-wrap');
    const search = header.querySelector('#search');
    if (searchToggle && searchWrap && search && !searchToggle.dataset.homeNavFixBound) {
      searchToggle.dataset.homeNavFixBound = '1';
      searchToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        searchWrap.classList.add('search-open');
        searchWrap.classList.remove('open');
        searchToggle.setAttribute('aria-expanded', 'true');
        setSearchA11yState(search, document.querySelector('#search-clear'), true);
        centerSearch();
        search.focus();
        document.dispatchEvent(new Event('cinema:search-opened'));
      });
      search.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          search.value = '';
          search.blur();
          searchWrap.classList.remove('search-open', 'open');
          searchToggle.setAttribute('aria-expanded', 'false');
          setSearchA11yState(search, document.querySelector('#search-clear'), false);
          document.querySelector('#search-suggestions')?.classList.remove('visible');
          document.querySelector('#search-clear')?.classList.remove('visible');
          search.style.setProperty('opacity', '0', 'important');
          search.style.setProperty('pointer-events', 'none', 'important');
          search.style.setProperty('display', 'none', 'important');
          searchToggle.focus({ preventScroll: true });
          document.dispatchEvent(new Event('cinema:search-closed'));
          return;
        }
        if (event.key === 'Enter' && search.value.trim()) {
          go(`index.html?search=${encodeURIComponent(search.value.trim())}`);
        }
      });
    }

    // Search can already be open on the results page after navigation.
    if (searchWrap.classList.contains('open')
      || searchWrap.classList.contains('search-open')
      || search.value.trim()) {
      setSearchA11yState(search, document.querySelector('#search-clear'), true);
      centerSearch();
    } else {
      setSearchA11yState(search, document.querySelector('#search-clear'), false);
    }

    if (!document.body.dataset.homeNavFixCloseBound) {
      document.body.dataset.homeNavFixCloseBound = '1';
      document.addEventListener('click', () => {
        header.querySelectorAll('.nav-submenu.open').forEach((item) => item.classList.remove('open'));
      });
    }
  }

  bind();
  if (!document.documentElement.dataset.globalSearchFix) {
    document.documentElement.dataset.globalSearchFix = '1';
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest?.('#search-toggle');
      if (!toggle) return;
      const wrap = document.querySelector('#search-wrap');
      const input = document.querySelector('#search');
      if (!wrap || !input) return;
      event.preventDefault();
      event.stopPropagation();
      wrap.classList.add('search-open', 'open');
      toggle.setAttribute('aria-expanded', 'true');
      setSearchA11yState(input, document.querySelector('#search-clear'), true);
      centerSearch();
      input.focus();
      document.dispatchEvent(new Event('cinema:search-opened'));
    }, true);
  }
  window.addEventListener('resize', centerSearch);
  document.addEventListener('DOMContentLoaded', bind, { once: true });
  const headerObserver = new MutationObserver(() => {
    const header = document.querySelector('.cinema-shell-header, #header');
    if (!header) return;
    bind();
    if (header.dataset.homeNavFix === '1') headerObserver.disconnect();
  });
  if (!document.querySelector('.cinema-shell-header, #header')) {
    headerObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();

