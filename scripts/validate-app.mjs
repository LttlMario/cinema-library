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

expect(stream.includes('autoplay=false'), 'provider URL keeps autoplay disabled');
expect(stream.includes('if (!playbackIntent)'), 'provider play events require explicit playback intent');
expect(stream.includes('requestProviderPlay'), 'all explicit play paths use the intent gate');
expect(!/\bownCommand\(['"]play['"]\)/.test(stream.replace(/function requestProviderPlay[\s\S]*?\n}\n/, '')), 'no unguarded direct play command remains');
expect(stream.includes("event.source !== playerFrame.contentWindow"), 'player events are accepted only from the active iframe');
expect(stream.includes("event.source !== window.parent"), 'player remote keys are accepted only from the wrapper page');
expect(stream.includes('providerReadyFallbackTimer'), 'player controls have a non-autoplay readiness fallback');

expect(index.includes('searchAbortController'), 'search requests are abortable');
expect(index.includes('TMDB_CACHE_MAX_ENTRIES'), 'TMDB cache is bounded to prevent TV storage stalls');
expect(index.includes("modal-watch-btn'), $('modal-favorite-btn'), $('modal-later-btn'), $('modal-watched-btn"), 'popup focus follows visible button order');
expect(index.includes('sw.js?v=20261025-v25'), 'page registers the current service-worker revision');
expect(sw.includes('cinema-library-shell-v25'), 'service-worker cache revision matches the page');
expect(sw.includes("url.searchParams.has('fresh')"), 'service-worker supports forced fresh document loads');
expect(sw.includes("url.pathname !== '/stream/index.html'"), 'fresh player loads are not duplicated in the service-worker cache');

expect(tvIndex.includes('tvapp=1.7.8&fresh=1'), 'TV wrapper requests a fresh live document');
expect(tvMain.includes('tvapp=1.7.8&fresh=1'), 'TV retry path requests a fresh live document');
expect(tvMain.includes('BACK_HANDSHAKE_TIMEOUT = 700'), 'TV Back uses the guarded handshake timeout');
expect(tvMain.includes('event.source !== frame.contentWindow'), 'TV accepts Back acknowledgements only from the live page');
expect(tvConfig.includes('version="1.7.8"'), 'TV package version matches the wrapper source');
expect(read('assets/site-shell.js').includes('let contentReturn = null'), 'secondary-page TV navigation remembers content return position');
expect(read('assets/nav-parity.css').includes('html.tv-mode.keynav main'), 'secondary-page TV focus is visibly highlighted');

console.log(`Cinema Library validation passed (${checks.length} checks).`);
