import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const checks = [];
const fail = message => { throw new Error(message); };
const expect = (condition, message) => { checks.push(message); if (!condition) fail(message); };

for (const file of ['sw.js', 'app/samsung-tv/main.js']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
for (const file of ['index.html', 'stream/index.html']) {
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
expect(stream.includes('providerReadyFallbackTimer'), 'player controls have a non-autoplay readiness fallback');
expect(stream.includes("if (cur === $('own-next')) { openEpisodePicker(); return; }"), 'TV remote Enter opens the episode picker directly');
expect(stream.includes('subtitleAutoController') && stream.includes('signal: controller.signal'), 'automatic subtitle fetches are cancelled when the player load changes');
expect(stream.includes("if (error.name === 'AbortError') return;"), 'cancelled subtitle fetches do not show stale errors');
expect(stream.includes('const tmdbInFlight = new Map()') && stream.includes('tmdbInFlight.get(localizedPath)'), 'player TMDB requests are deduplicated while in flight');
expect(stream.includes('subtitleRequestController') && stream.includes("subtitleRequestController?.abort()"), 'manual subtitle requests are cancelled on stop or player changes');
expect(stream.includes('<link rel="preconnect" href="https://cinesrc.st" crossorigin>') && stream.includes('<link rel="preconnect" href="https://api.themoviedb.org">'), 'player preconnects to the video provider and TMDB before fetching starts');
expect(stream.includes('<link rel="preconnect" href="https://cinema-library-subtitles-api.bmariomihail.chatgpt.site">'), 'player preconnects to the subtitle API before automatic subtitle fetching');
expect(stream.includes('function scheduleAutomaticSubtitleLoad(loadToken)') && stream.includes('scheduleAutomaticSubtitleLoad(playerLoadToken)'), 'automatic subtitles wait for provider readiness instead of competing with initial media fetching');

expect(index.includes('searchAbortController'), 'search requests are abortable');
expect(index.includes('TMDB_CACHE_MAX_ENTRIES'), 'TMDB cache is bounded to prevent TV storage stalls');
expect(index.includes('cancelHomeWork()') && index.includes('resetHomeWork()'), 'homepage TMDB work is cancelled while the player opens');
expect(index.includes('homeWorkGeneration') && index.includes('homeGeneration !== homeWorkGeneration'), 'intentional TMDB cancellations stay silent');
expect(index.includes("TMDB_MAX_IN_FLIGHT = document.documentElement.classList.contains('tv-mode') ? 3 : 5"), 'TV limits concurrent TMDB requests to protect WebView responsiveness');
expect(index.includes('FRANCHISE_ROWS.forEach((cfg, index)') && index.includes('index * 350'), 'web franchise rows are staggered to avoid a post-paint request burst');
expect(index.includes('#rows-container .row {') && index.includes('content-visibility: auto'), 'web and TV rows defer below-the-fold layout work');
expect(index.includes('Personalization is secondary to the first paint') && index.includes('if (!isTvMode) loadPersonalizedRow();'), 'web personalization waits until core homepage content is loaded');
expect(siteShell.includes('aria-current="${active === key ? \'page\' : \'false\'}"') && siteShell.includes('aria-expanded="false"'), 'shell navigation exposes active page and dropdown state to TV WebViews');
expect(siteShell.includes('function') && siteShell.includes('syncShellMenuState') && siteShell.includes('MutationObserver'), 'shell navigation keeps aria-expanded synchronized with visible dropdowns');
expect(siteShell.includes('aria-expanded="false"') && siteShell.includes("setAttribute('aria-expanded', 'true')") && homeNavFix.includes("setAttribute('aria-expanded', 'false')"), 'search toggle exposes and updates its expanded state');
expect(index.includes('<div class="search-wrap" id="search-wrap">') && !index.includes('<div class="search-wrap open" id="search-wrap">'), 'TV starts with the sidebar Search button visible, not the floating field');
expect(index.includes('<a class="nav-link active" href="index.html" data-nav="home" aria-current="page">Acasă</a>'), 'Home is a native focusable navigation control on the TV layout');
expect(homeNavFix.includes("cinema:search-opened") && homeNavFix.includes("cinema:search-closed") && index.includes("key: 'search-input'"), 'Search keeps the TV focus state synchronized while opening and closing');
expect(homeNavFix.includes("location.hash === '#favorites'") && homeNavFix.includes("favorites.setAttribute('aria-current'"), 'watchlist remains the active red destination on the favorites hash');
expect(index.includes('franchiseRowsInFlight') && index.includes('loadFranchiseRowInternal'), 'franchise row requests are deduplicated while a row is loading');
expect(index.includes('cinema-library-subtitles-api.bmariomihail.chatgpt.site'), 'homepage preconnects to the subtitle API used by the player overlay');
expect(!index.includes("['movie',330459],['movie',330459]"), 'franchise rows do not request duplicate titles');
expect(index.includes("modal-watch-btn'), $('modal-favorite-btn'), $('modal-later-btn'), $('modal-watched-btn"), 'popup focus follows visible button order');
expect(index.includes('sw.js?v=20261025-v27'), 'page registers the current service-worker revision');
expect(sw.includes('cinema-library-shell-v27-cache-safe-20261025'), 'service-worker cache revision matches the page');
expect(sw.includes("url.searchParams.has('fresh')"), 'service-worker supports forced fresh document loads');
expect(sw.includes("url.pathname !== '/stream/index.html'"), 'fresh player loads are not duplicated in the service-worker cache');
expect(sw.includes('isStaticAsset') && sw.includes('request.destination'), 'service-worker does not cache arbitrary dynamic same-origin requests');
expect((sw.match(/cache\.put\([^\n]+\)\)\.catch\(\(\) => \{\}\)/g) || []).length >= 3, 'service-worker ignores cache quota failures without breaking the page');

expect(tvIndex.includes('tvapp=1.7.8') && !tvIndex.includes('tvapp=1.7.8&fresh=1'), 'TV wrapper uses the cached shell on normal startup');
expect(tvMain.includes('tvapp=1.7.8&fresh=1'), 'TV retry path requests a fresh live document');
expect(tvMain.includes('BACK_HANDSHAKE_TIMEOUT = 700'), 'TV Back uses the guarded handshake timeout');
expect(tvMain.includes('event.source !== frame.contentWindow'), 'TV accepts Back acknowledgements only from the live page');
expect(tvMain.includes('errorTimer') && tvMain.includes('clearTimeout(errorTimer)'), 'TV retry clears stale load-error timers');
expect(tvIndex.includes('https://image.tmdb.org') && tvIndex.includes('https://cinesrc.st') && tvIndex.includes('cinema-library-subtitles-api.bmariomihail.chatgpt.site'), 'TV wrapper preconnects to image, video and subtitle origins');
expect(tvConfig.includes('version="1.7.8"'), 'TV package version matches the wrapper source');
expect(read('assets/site-shell.js').includes('let contentReturn = null'), 'secondary-page TV navigation remembers content return position');
expect(read('assets/nav-parity.css').includes('html.tv-mode.keynav main'), 'secondary-page TV focus is visibly highlighted');
expect(read('assets/home-nav-fix.js').includes("event.key === 'Escape'") && read('assets/home-nav-fix.js').includes('searchToggle.focus'), 'Search Escape restores focus to the sidebar button');

console.log(`Cinema Library validation passed (${checks.length} checks).`);
