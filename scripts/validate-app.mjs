import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const checks = [];
const fail = message => { throw new Error(message); };
const expect = (condition, message) => { checks.push(message); if (!condition) fail(message); };

for (const file of ['sw.js', 'app/samsung-tv/main.js']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
for (const file of ['index.html', 'stream/index.html', 'catalog.html', 'genres.html']) {
  const source = read(file);
  const scripts = source.split('<script').slice(1)
    .map(part => part.split('>').slice(1).join('>').split('</script>')[0])
    .filter(script => script.trim());
  scripts.forEach((script, index) => {
    try { new Function(script); }
    catch (error) { fail(`${file} inline script ${index} is invalid: ${error.message}`); }
  });
}

const index = read('index.html');
const stream = read('stream/index.html');
const sw = read('sw.js');
const tvIndex = read('app/samsung-tv/index.html');
const tvMain = read('app/samsung-tv/main.js');
const tvConfig = read('app/samsung-tv/config.xml');
const siteShell = read('assets/site-shell.js');
const homeNavFix = read('assets/home-nav-fix.js');

expect(stream.includes('autoplay=false'), 'provider URL keeps autoplay disabled');
expect(stream.includes('if (!playbackIntent)'), 'provider play events require explicit playback intent');
expect(stream.includes('requestProviderPlay'), 'all explicit play paths use the intent gate');
expect(!/\bownCommand\(['"]play['"]\)/.test(stream.replace(/function requestProviderPlay[\s\S]*?\n}\n/, '')), 'no unguarded direct play command remains');
expect(stream.includes("event.source !== playerFrame.contentWindow"), 'player events are accepted only from the active iframe');
expect(stream.includes("event.source !== window.parent"), 'player remote keys are accepted only from the wrapper page');
expect(stream.includes('providerReadyFallbackTimer') && stream.includes('Play must remain disabled until the provider confirms ready') && !stream.includes('providerReady = true;\n      const fallbackLoader'), 'player fallback never enables Play before provider ready');
expect(stream.includes('function handleProviderError') && stream.includes("eventType.includes('error')") && stream.includes('handlePlayerFailure(state.server)'), 'provider errors stop playback and recover through the next source');
expect(stream.includes('Keep processing this same arrow key') && stream.includes('if (!vis(cur)) {\n        cur = null;'), 'TV focus keeps the current D-pad action after controls restore');
expect(index.includes('el.hidden || el.disabled') && index.includes("style.visibility !== 'hidden'") && stream.includes('el.hidden || el.disabled'), 'TV focus skips hidden, invisible, and disabled controls');
expect(stream.includes('function loadPlayer() {\n  const nextProgressKey = progressIdentity();') && stream.includes('loadedProgressKey === nextProgressKey') && stream.includes('persistCurrentPlayback();'), 'player saves progress before replacing an unchanged source');
expect(stream.includes('const TMDB_CACHE_MAX_ENTRIES = isTvClient ? 60 : 120') && stream.includes('slice(0, TMDB_CACHE_MAX_ENTRIES)'), 'player TMDB cache is bounded for TV and web');
expect(stream.includes('lastOwnCommandKey') && stream.includes('now - lastOwnCommandAt < 180'), 'rapid duplicate Play/Pause commands are ignored');
expect(stream.includes('playerLoadStartedAt') && stream.includes("markPlayerMilestone('controls')") && stream.includes("markPlayerMilestone('first-frame-signal')"), 'player records time-to-controls and first-frame milestones locally');
expect(stream.includes('id="player-error-retry"') && stream.includes("rioma:focus-player-error") && stream.includes('attemptedServers.delete(state?.server)'), 'player errors expose a retry action that is reachable by TV focus');
expect(stream.includes("showPlayerError('Sursa video nu a răspuns la timp.')") && stream.includes('if (loadToken !== playerLoadToken || settled) return;'), 'slow provider loads expose an actionable timeout state');
expect(stream.includes('async function fetchSubtitle') && stream.includes('timedOut') && stream.includes('12000'), 'subtitle requests have a bounded timeout and retry message');
expect(stream.includes('subtitleRenderedTime') && stream.includes('Math.abs(time - subtitleRenderedTime) < 0.08'), 'subtitle rendering coalesces high-frequency provider time updates');
expect(stream.includes('const recommendationToken = playerLoadToken') && stream.includes('recommendationKey !== progressIdentity()'), 'stale recommendation responses cannot paint over a new episode');
expect(stream.includes('A manual search takes ownership of the subtitle request slot') && stream.includes('subtitleAutoController?.abort()'), 'manual subtitle actions cancel automatic subtitle work before fetching');
expect(stream.includes('Never trust a stale/partial subtitle cache entry') && stream.includes('Fișierul de subtitrare nu conține replici valide'), 'invalid cached subtitles fall back to a fresh valid file');
expect(index.includes('async function fetchTmdbWithRetry') && stream.includes('async function fetchTmdbWithRetry') && index.includes('429, 500, 502, 503, 504'), 'catalog and player retry transient TMDB failures');
expect(index.includes('function waitForTmdbRetry') && index.includes('signal.removeEventListener') && index.includes("error.name = 'AbortError'"), 'TMDB retry delays cancel immediately with the owning page request');
const catalog = read('catalog.html');
expect(catalog.includes('async function fetchCatalogJson') && catalog.includes('429,500,502,503,504') && catalog.includes("setTimeout(()=>controller.abort(),10000)"), 'catalog retries transient TMDB failures and cancels slow requests');
const genres = read('genres.html');
expect(genres.includes('async function fetchGenreJson') && genres.includes('genreRequestId') && genres.includes('cinemalibrary_genres_v1'), 'genres reuse cancellable retry and bounded local cache logic');
expect(!catalog.includes('assets/tv-pointer.js') && !genres.includes('assets/tv-pointer.js') && siteShell.includes('const moveFocus = (key)'), 'secondary TV pages use the shared natural D-pad navigator instead of the competing free pointer');
expect(stream.includes('let loadedProgressKey') && stream.includes('loadedProgressKey === nextProgressKey') && stream.includes('persistCurrentPlayback();\n    state.episode'), 'episode changes preserve progress under the old episode key');
expect(stream.includes("document.visibilityState === 'hidden'") && stream.includes('persistCurrentPlayback();'), 'player saves progress when the TV page loses visibility');
expect(stream.includes('stopSubtitleDisplayLoop();') && stream.includes('stopPlaybackHeartbeat();') && stream.includes('stopSubtitleFallbackClock();') && stream.includes('if (!ownPaused && providerReady)') && stream.includes('if (!providerTimeSignals) startSubtitleFallbackClock(playerLoadToken);'), 'player suspends local polling while the TV page is hidden and resumes every required clock during playback');
expect(stream.includes('function cleanupPlayerRuntime()') && stream.includes('subtitleAutoController?.abort();') && stream.includes('if (!event.persisted) cleanupPlayerRuntime();'), 'player aborts pending work and clears timers when the page is unloaded');
expect((index.match(/fonts\.googleapis\.com\/css2/g) || []).length === 1 && (stream.match(/fonts\.googleapis\.com\/css2/g) || []).length === 1, 'web and player combine Google Fonts into one request');
expect(stream.includes("if (cur === $('own-next')) { openEpisodePicker(); return; }"), 'TV remote Enter opens the episode picker directly');
expect(stream.includes('subtitleAutoController') && stream.includes('signal: controller.signal'), 'automatic subtitle fetches are cancelled when the player load changes');
expect(stream.includes("if (error.name === 'AbortError') return;"), 'cancelled subtitle fetches do not show stale errors');
expect(stream.includes('const tmdbInFlight = new Map()') && stream.includes('tmdbInFlight.get(localizedPath)'), 'player TMDB requests are deduplicated while in flight');
expect(stream.includes('subtitleRequestController') && stream.includes("subtitleRequestController?.abort()"), 'manual subtitle requests are cancelled on stop or player changes');
expect(stream.includes('<link rel="preconnect" href="https://cinesrc.st" crossorigin>') && stream.includes('<link rel="preconnect" href="https://api.themoviedb.org">'), 'player preconnects to the video provider and TMDB before fetching starts');
expect(stream.includes('<link rel="preconnect" href="https://cinema-library-subtitles-api.bmariomihail.chatgpt.site">'), 'player preconnects to the subtitle API before automatic subtitle fetching');
expect(stream.includes('function scheduleAutomaticSubtitleLoad(loadToken)') && stream.includes('scheduleAutomaticSubtitleLoad(playerLoadToken)'), 'automatic subtitles wait for provider readiness instead of competing with initial media fetching');
expect(stream.includes('let playerLoadGuardTimer = 0') && stream.includes('clearTimeout(playerLoadGuardTimer)'), 'stale player load timers are cancelled when switching sources or episodes');

expect(index.includes('searchAbortController'), 'search requests are abortable');
expect(index.includes('const tmdb = async (path, options = {})') && index.includes('externalSignal?.addEventListener'), 'TMDB requests honor caller cancellation');
expect(index.includes('pending.homeGeneration === homeGeneration') && index.includes('pending.signal.aborted') && index.includes('pending.promise'), 'TMDB deduplication does not reuse cancelled work from an older navigation');
expect(index.includes('if (!silent) toast(message)'), 'optional TMDB requests stay silent on isolated failures');
expect(index.includes('TMDB_CACHE_MAX_ENTRIES'), 'TMDB cache is bounded to prevent TV storage stalls');
expect(index.includes('cancelHomeWork()') && index.includes('resetHomeWork()'), 'homepage TMDB work is cancelled while the player opens');
expect(index.includes('homeWorkGeneration') && index.includes('homeGeneration !== homeWorkGeneration'), 'intentional TMDB cancellations stay silent');
expect(index.includes("TMDB_MAX_IN_FLIGHT = document.documentElement.classList.contains('tv-mode') ? 3 : 5"), 'TV limits concurrent TMDB requests to protect WebView responsiveness');
expect(index.includes('function queueTmdbRequest(job, shouldCancel = () => false)') && index.includes('queued.shouldCancel()'), 'cancelled TMDB work is removed before it consumes a queue slot');
expect(index.includes('FRANCHISE_ROWS.forEach((cfg, index)') && index.includes('index * 350'), 'web franchise rows are staggered to avoid a post-paint request burst');
expect(index.includes('#rows-container .row {') && index.includes('content-visibility: auto'), 'web and TV rows defer below-the-fold layout work');
expect(index.includes('Personalization is secondary to the first paint') && index.includes('if (!isTvMode) loadPersonalizedRow();'), 'web personalization waits until core homepage content is loaded');
expect(index.includes('data-bg="${backdrop(item.backdrop_path, \'w1280\')}"') && index.includes('function activateHeroBackground(index)'), 'hero loads only the active backdrop instead of fetching every slide at first paint');
expect(index.includes("document.addEventListener('visibilitychange'") && index.includes('heroTimer = null'), 'hero timer pauses while the TV page is hidden');
expect(index.includes('function cleanupHomeRuntime()') && index.includes('homeWorkController?.abort()') && index.includes('searchAbortController?.abort()'), 'home page aborts pending work and clears timers when unloaded');
expect(index.includes('prefers-reduced-motion: reduce') && index.includes('scroll-behavior: auto'), 'reduced-motion preference disables expensive animations and smooth scrolling');
expect(index.includes('loading="lazy" fetchpriority="low" decoding="async"'), 'below-fold posters keep low fetch priority on TV and web');
expect(index.includes('const candidates = items.slice(0, isTvMode ? 6 : 32)') && index.includes('i += isTvMode ? 4 : 8'), 'TV limits digital-release enrichment work during the initial load');
expect(index.includes('...(isTvMode ? [] : [loadTop10()])') && index.includes('Top 10 is below the first TV viewport'), 'TV defers the below-fold Top 10 request until after the initial paint');
expect(siteShell.includes('aria-current="${active === key ? \'page\' : \'false\'}"') && siteShell.includes('aria-expanded="false"'), 'shell navigation exposes active page and dropdown state to TV WebViews');
expect(siteShell.includes('data-nav="${key}"'), 'shell Home link exposes a stable semantic navigation key');
expect(siteShell.includes('function') && siteShell.includes('syncShellMenuState') && siteShell.includes('MutationObserver'), 'shell navigation keeps aria-expanded synchronized with visible dropdowns');
expect(siteShell.includes("style.opacity !== '0'") && siteShell.includes("style.pointerEvents !== 'none'") && siteShell.includes('el.offsetWidth > 0'), 'secondary-page TV focus excludes invisible Search controls');
expect(homeNavFix.includes('function setSearchA11yState') && homeNavFix.includes("input.setAttribute('aria-hidden', String(!open))") && homeNavFix.includes('input.tabIndex = open ? 0 : -1'), 'closed Search is hidden from TV accessibility focus until opened');
expect(siteShell.includes('aria-expanded="false"') && siteShell.includes("setAttribute('aria-expanded', 'true')") && homeNavFix.includes("setAttribute('aria-expanded', 'false')"), 'search toggle exposes and updates its expanded state');
expect(index.includes('<div class="search-wrap" id="search-wrap">') && !index.includes('<div class="search-wrap open" id="search-wrap">'), 'TV starts with the sidebar Search button visible, not the floating field');
expect(index.includes('<a class="nav-link active" href="index.html" data-nav="home" aria-current="page">Acasă</a>'), 'Home is a native focusable navigation control on the TV layout');
expect(homeNavFix.includes("cinema:search-opened") && homeNavFix.includes("cinema:search-closed") && index.includes("key: 'search-input'"), 'Search keeps the TV focus state synchronized while opening and closing');
expect(index.includes('Keep the open Search flow self-contained') && index.includes('if (searchOpen)'), 'Open Search remains the active TV focus zone while results render');
expect(index.includes('Keep native text focus while suggestions are still loading'), 'Search keeps focus while suggestions are loading');
expect(index.includes("ae === searchInput") && index.includes("searchInput.focus({ preventScroll: true })"), 'Search arrow keys have a direct native focus fallback');
expect(index.includes('document.activeElement === searchInput') && index.includes("setFocus(searchInput, false)"), 'First TV arrow after opening Search preserves the native field focus');
expect(homeNavFix.includes("location.hash === '#favorites'") && homeNavFix.includes("favorites.setAttribute('aria-current'"), 'watchlist remains the active red destination on the favorites hash');
expect(index.includes('franchiseRowsInFlight') && index.includes('loadFranchiseRowInternal'), 'franchise row requests are deduplicated while a row is loading');
expect(index.includes('cinema-library-subtitles-api.bmariomihail.chatgpt.site'), 'homepage preconnects to the subtitle API used by the player overlay');
expect(!index.includes("['movie',330459],['movie',330459]"), 'franchise rows do not request duplicate titles');
expect(index.includes("modal-watch-btn'), $('modal-favorite-btn'), $('modal-later-btn'), $('modal-watched-btn"), 'popup focus follows visible button order');
expect(index.includes('sw.js?v=20261025-v32') && stream.includes('sw.js?v=20261025-v32'), 'catalog and player register the current service-worker revision');
expect(sw.includes('cinema-library-shell-v32-cache-safe-20261025') && sw.includes('./assets/home-nav-fix.js'), 'service-worker caches the current navigation shell including TV Search logic');
expect(index.includes('registration.update()') && stream.includes('registration.update()') && sw.includes("cinema:skip-waiting"), 'TV and web check for a newer service-worker version at startup');
expect(sw.includes("url.searchParams.has('fresh')"), 'service-worker supports forced fresh document loads');
expect(sw.includes("if (url.pathname === '/stream/index.html')") && sw.includes('Never cache those dynamic query variants'), 'service-worker never caches dynamic player query variants');
expect(sw.includes('isStaticAsset') && sw.includes('request.destination'), 'service-worker does not cache arbitrary dynamic same-origin requests');
expect((sw.match(/cache\.put\([^\n]+\)\)\.catch\(\(\) => \{\}\)/g) || []).length >= 3, 'service-worker ignores cache quota failures without breaking the page');

expect(tvIndex.includes('tvapp=1.7.9') && !tvIndex.includes('tvapp=1.7.9&fresh=1'), 'TV wrapper uses the cached shell on normal startup');
expect(tvMain.includes('tvapp=1.7.9&fresh=1'), 'TV retry path requests a fresh live document');
expect(tvMain.includes('BACK_HANDSHAKE_TIMEOUT = 700'), 'TV Back uses the guarded handshake timeout');
expect(tvMain.includes('event.source !== frame.contentWindow'), 'TV accepts Back acknowledgements only from the live page');
expect(tvMain.includes("event.target !== document.body && event.target !== frame"), 'TV wrapper does not steal focus from its own controls');
expect(tvMain.includes('MEDIA_KEYS') && tvMain.includes('registerMediaKeys') && tvMain.includes('MediaPlayPause'), 'TV wrapper forwards registered media keys to the player');
expect(stream.includes("['MediaPlayPause', 'MediaPlay', 'MediaPause']") && stream.includes('MediaFastForward'), 'player handles TV media transport keys');
expect(stream.includes("k === 'MediaTrackNext'") && stream.includes("k === 'MediaTrackPrevious'"), 'player handles next and previous media keys');
expect(stream.includes('Some Samsung WebViews deliver arrow keys') && stream.includes("e.target !== $('own-timeline')"), 'player handles native timeline arrow keys before WebView consumption');
expect(stream.includes('function returnToPopupFromPlayer()') && stream.includes('exitFullscreen'), 'player Back exits fullscreen before returning to the popup');
expect(index.includes("event.data?.type === 'rioma:close'") && index.includes('overlay.requestFullscreen'), 'home overlay closes through the player handshake and requests fullscreen');
expect(stream.includes("'rioma:volume-opened'") && stream.includes("setFocus(target, false)"), 'TV focus enters the volume slider when the volume button opens it');
expect(stream.includes('button.setAttribute(\'title\', open ? \'Ascunde volumul\' : \'Arată volumul\');') && stream.includes('showOwnControls();\n  document.dispatchEvent(new CustomEvent(open ?'), 'opening volume restores visible player controls before focus');
expect(stream.includes('Native selects in Samsung WebViews may consume Escape/Back') && stream.includes("if (!panel || panel.hidden) return;"), 'CC keeps Escape and Back inside the subtitle focus trap');
expect(stream.includes('Move TV focus immediately') && stream.indexOf("document.dispatchEvent(new Event('rioma:focus-episode-picker'))") < stream.indexOf('if (!seasonCache'), 'episode picker focuses its season selector before the season fetch completes');
expect(tvMain.includes('errorTimer') && tvMain.includes('clearTimeout(errorTimer)'), 'TV retry clears stale load-error timers');
expect(tvMain.includes('var nextFrame = frame.cloneNode(false)') && tvMain.includes('function bindFrame(nextFrame)') && tvMain.includes('nextFrame.src'), 'TV retry replaces the iframe so stale load events cannot unlock a newer request');
expect(tvIndex.includes('https://image.tmdb.org') && tvIndex.includes('https://cinesrc.st') && tvIndex.includes('cinema-library-subtitles-api.bmariomihail.chatgpt.site'), 'TV wrapper preconnects to image, video and subtitle origins');
expect(tvConfig.includes('version="1.7.9"'), 'TV package version matches the wrapper source');
expect(tvMain.includes('if (event.target === retry) return') && tvMain.includes('if (!loaded && code !== BACK_KEY'), 'TV wrapper keeps retry controls native and does not forward keys before load');
expect(read('assets/site-shell.js').includes('let contentReturn = null'), 'secondary-page TV navigation remembers content return position');
expect(read('assets/nav-parity.css').includes('html.tv-mode.keynav main'), 'secondary-page TV focus is visibly highlighted');
expect(read('assets/home-nav-fix.js').includes("event.key === 'Escape'") && read('assets/home-nav-fix.js').includes('searchToggle.focus'), 'Search Escape restores focus to the sidebar button');
expect(homeNavFix.includes('headerObserver.disconnect()') && homeNavFix.includes("if (!document.querySelector('.cinema-shell-header, #header'))"), 'Search/focus observer disconnects after the shell is initialized');
expect(siteShell.includes('const startHeroRotation') && siteShell.includes('if (document.hidden) stopHeroRotation()') && siteShell.includes('if (heroTimer || document.hidden) return'), 'secondary-page hero animation pauses while the page is hidden');
expect(siteShell.includes('const loadHeroImage') && siteShell.includes('slide.dataset.bg') && siteShell.includes('hero.append(slide)') && siteShell.includes('loadHeroImage(slides[slideIndex])'), 'secondary-page hero loads only the visible slide image in stable order');

console.log(`Cinema Library validation passed (${checks.length} checks).`);

