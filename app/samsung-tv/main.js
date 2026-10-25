(function () {
  'use strict';

  var frame = document.getElementById('app-frame');
  var loading = document.getElementById('app-loading');
  var error = document.getElementById('app-error');
  var retry = document.getElementById('retry');
  var loaded = false;
  var backHandledByWeb = false;
  var backRequestId = 0;
  var BACK_HANDSHAKE_TIMEOUT = 700;
  var BACK_KEY = 10009;
  var EXIT_KEYS = { 10182: true, 27: true };

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
    loading.hidden = false;
    error.hidden = true;
    frame.src = 'https://cinema.panel-pro.ro/?tv=1&tvapp=1.7.8&fresh=1&retry=' + Date.now();
    window.setTimeout(showError, 15000);
  }

  function showError() {
    if (!loaded) {
      loading.hidden = true;
      error.hidden = false;
    }
  }

  frame.addEventListener('load', function () {
    loaded = true;
    backHandledByWeb = false;
    loading.hidden = true;
    error.hidden = true;
    frame.setAttribute('tabindex', '0');
    try { frame.focus(); frame.contentWindow.focus(); } catch (_) {}
  });
  retry.addEventListener('click', retryLoad);
  window.addEventListener('message', function (event) {
    // Ignore acknowledgements from unrelated frames or browser extensions.
    // Only the live page inside our wrapper may claim that Back was handled.
    if (event.source !== frame.contentWindow) return;
    if (event.data && ['cinema:player-closed', 'cinema:back-handled'].includes(event.data.type)) backHandledByWeb = true;
  });
  document.addEventListener('focus', function () {
    try { frame.focus(); frame.contentWindow.focus(); } catch (_) {}
  }, true);
  document.addEventListener('keydown', function (event) {
    var code = Number(event.keyCode || event.which);
    var key = event.key || ({37:'ArrowLeft', 38:'ArrowUp', 39:'ArrowRight', 40:'ArrowDown', 13:'Enter'}[code] || '');
    if (code === BACK_KEY) {
      event.preventDefault();
      var requestId = ++backRequestId;
      backHandledByWeb = false;
      // Let the live page/player handle Back first. The player uses this to
      // activate its own fullscreen Back button and return to the popup.
      try { frame.contentWindow.postMessage({ type: 'cinema:remote-key', key: 'Back' }, '*'); } catch (_) {}
      window.setTimeout(function () {
        if (requestId !== backRequestId || backHandledByWeb) return;
        try {
          if (frame.contentWindow.history.length > 1) frame.contentWindow.history.back();
          else exitApplication();
        } catch (_) { exitApplication(); }
      }, BACK_HANDSHAKE_TIMEOUT);
    } else if (EXIT_KEYS[code]) {
      event.preventDefault();
      exitApplication();
    } else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
      // If Samsung keeps focus on the outer document, forward the remote
      // command into the live web page inside the iframe.
      try { frame.contentWindow.postMessage({ type: 'cinema:remote-key', key: key }, '*'); } catch (_) {}
      event.preventDefault();
    }
  }, true);
  window.setTimeout(showError, 15000);
}());
