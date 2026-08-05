// Restore SPA route from GitHub Pages 404 redirect.
// Kept as an external file (not inline) so a strict CSP without 'unsafe-inline' still works.
// Must run as a classic script before the deferred app module so React Router sees the final URL.
(function () {
  try {
    var redirect = sessionStorage.getItem('redirect');
    if (!redirect) return;
    sessionStorage.removeItem('redirect');
    var base = '/borderlands-loot-hub';
    var route = redirect.indexOf(base) === 0 ? redirect.slice(base.length) : redirect;
    if (route && route !== '/' && route !== '') {
      window.history.replaceState(null, '', base + route);
    }
  } catch (e) {
    // sessionStorage can throw in private mode or sandboxed iframes; routing still works without restore.
  }
})();
