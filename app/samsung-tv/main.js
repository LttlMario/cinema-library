(function () {
  'use strict';

  var frame = document.getElementById('app-frame');
  var loading = document.getElementById('app-loading');
  var error = document.getElementById('app-error');
  var retry = document.getElementById('retry');
  var loaded = false;
  var appReady = false;
  var errorTimer = 0;
  var readyTimer = 0;
  var backHandledByWeb = false;
  var backRequestId = 0;
  var lastForwardedKey = '';
  var lastForwardedAt = 0;
  var BACK_HANDSHAKE_TIMEOUT = 1200;
  var LIVE_ORIGIN = 'https://cinema.panel-pro.ro';
  var BACK_KEY = 10009;
  var EXIT_KEYS = { 10182: true, 27: true };
  var MEDIA_KEYS = {
    10252: 'MediaPlayPause',
    415: 'MediaPlay',
    19: 'MediaPause',
    413: 'MediaStop',
    417: 'MediaFastForward',
    412: 'MediaRewind',
    10233: 'MediaTrackNext',
    10232: 'MediaTrackPrevious'
  };

  function registerMediaKeys() {
    try {
      var device = window.tizen && tizen.tvinputdevice;
      if (!device || typeof device.registerKey !== 'function') return;
      Object.keys(MEDIA_KEYS).forEach(function (code) {
        try { device.registerKey(MEDIA_KEYS[code]); } catch (_) {}
      });
    } catch (_) {}
  }

  function currentApplication() {
    try {
      return window.tizen && tizen.application && tizen.application.getCurrentApplication
        ? tizen.application.getCurrentApplication() : null;
    } catch (_) { return null; }
  }

  function exitApplication() {
    var app = currentApplication();
    if (app && typeof app.exit === 'function') app.exit();
  }

  registerMediaKeys();

  function goBack() {
    try {
      if (frame.contentWindow.history.length > 1) {
        frame.contentWindow.history.back();
        return;
      }
    } catch (_) {}
    exitApplication();
  }

  function retryLoad() {
    loaded = false;
    appReady = false;
    backRequestId += 1;
    backHandledByWeb = false;
    window.clearTimeout(errorTimer);
    window.clearTimeout(readyTimer);
    loading.hidden = false;
    error.hidden = true;
    var nextFrame = frame.cloneNode(false);
    nextFrame.removeAttribute('src');
    frame.replaceWith(nextFrame);
    bindFrame(nextFrame);
    nextFrame.src = 'https://cinema.panel-pro.ro/index.html?tv=1&tvapp=1.7.13&fresh=1&retry=' + Date.now();
    errorTimer = window.setTimeout(showError, 15000);
  }

  function showError() {
    if (!loaded) {
      loading.hidden = true;
      error.hidden = false;
      try { retry.focus(); } catch (_) {}
    }
  }

  function handleFrameLoad() {
    loaded = true;
    window.clearTimeout(errorTimer);
    errorTimer = 0;
    window.clearTimeout(readyTimer);
    backHandledByWeb = false;
    // The iframe load event only means the document arrived. Keep the
    // loading layer until the live page confirms that its first TV rows are
    // painted, with a short fallback for older cached builds.
    loading.hidden = appReady;
    error.hidden = true;
    frame.setAttribute('tabindex', '0');
    try { frame.focus(); frame.contentWindow.focus(); } catch (_) {}
    readyTimer = window.setTimeout(function () {
      readyTimer = 0;
      if (loaded && !appReady) loading.hidden = true;
    }, 4000);
  }
  function handleFrameError() {
    loaded = false;
    appReady = false;
    backRequestId += 1;
    backHandledByWeb = false;
    window.clearTimeout(errorTimer);
    errorTimer = 0;
    window.clearTimeout(readyTimer);
    loading.hidden = true;
    error.hidden = false;
    try { retry.focus(); } catch (_) {}
  }
  function bindFrame(nextFrame) {
    frame = nextFrame;
    frame.addEventListener('load', handleFrameLoad);
    frame.addEventListener('error', handleFrameError);
  }
  function forwardKey(key) {
    var now = Date.now();
    // A few Samsung firmware versions deliver the same remote press twice
    // (once to the wrapper and once to the focused iframe). Coalesce only an
    // immediate duplicate; normal key-repeat remains untouched.
    if (key !== 'Back' && key === lastForwardedKey && now - lastForwardedAt < 55) return;
    lastForwardedKey = key;
    lastForwardedAt = now;
    try {
      frame.focus();
      frame.contentWindow.focus();
      frame.contentWindow.postMessage({ type: 'cinema:remote-key', key: key }, LIVE_ORIGIN);
    } catch (_) {}
  }
  function cleanupWrapperRuntime() {
    window.clearTimeout(errorTimer);
    errorTimer = 0;
    window.clearTimeout(readyTimer);
    backRequestId += 1;
    backHandledByWeb = false;
    lastForwardedKey = '';
    lastForwardedAt = 0;
  }
  bindFrame(frame);
  retry.addEventListener('click', retryLoad);
  window.addEventListener('message', function (event) {
    // Ignore acknowledgements from unrelated frames or browser extensions.
    // Only the live page inside our wrapper may claim that Back was handled.
    if (event.source !== frame.contentWindow || event.origin !== LIVE_ORIGIN) return;
    if (event.data && event.data.type === 'cinema:app-ready') {
      appReady = true;
      loading.hidden = true;
      return;
    }
    if (event.data && ['cinema:player-closed', 'cinema:back-handled'].includes(event.data.type)) backHandledByWeb = true;
  });
  document.addEventListener('focus', function (event) {
    // Do not steal focus from the wrapper's own controls (for example the
    // retry button). Only restore focus when the outer document or iframe
    // itself receives focus.
    if (event.target !== document && event.target !== document.body && event.target !== frame) return;
    try { frame.focus(); frame.contentWindow.focus(); } catch (_) {}
  }, true);
  document.addEventListener('keydown', function (event) {
    var code = Number(event.keyCode || event.which);
    var key = event.key || ({37:'ArrowLeft', 38:'ArrowUp', 39:'ArrowRight', 40:'ArrowDown', 13:'Enter'}[code] || '');
    // Keep the wrapper's retry control native. Forwarding its arrows into the
    // iframe makes the error state impossible to operate with the remote.
    if (event.target === retry) return;
    if (!loaded && code !== BACK_KEY && !EXIT_KEYS[code]) return;
    if (code === BACK_KEY) {
      event.preventDefault();
      event.stopPropagation();
      var requestId = ++backRequestId;
      backHandledByWeb = false;
      // Let the live page/player handle Back first. The player uses this to
      // activate its own fullscreen Back button and return to the popup.
      forwardKey('Back');
      window.setTimeout(function () {
        if (requestId !== backRequestId || backHandledByWeb) return;
        try {
          if (frame.contentWindow.history.length > 1) frame.contentWindow.history.back();
          else exitApplication();
        } catch (_) { exitApplication(); }
      }, BACK_HANDSHAKE_TIMEOUT);
    } else if (EXIT_KEYS[code]) {
      event.preventDefault();
      event.stopPropagation();
      exitApplication();
    } else if (MEDIA_KEYS[code]) {
      forwardKey(MEDIA_KEYS[code]);
      event.preventDefault();
      event.stopPropagation();
    } else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
      // If Samsung keeps focus on the outer document, forward the remote
      // command into the live web page inside the iframe.
      forwardKey(key);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  errorTimer = window.setTimeout(showError, 15000);
  window.addEventListener('pagehide', cleanupWrapperRuntime);
}());

