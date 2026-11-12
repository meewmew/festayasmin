(() => {
  const audio = document.querySelector('#background-music');
  const routes = new Map();
  const pageClasses = ['home-page', 'details-page'];
  const route = (path) => path === '/' ? '/' : /^\/confirmar\/?$/.test(path) ? '/confirmar' : null;
  const capture = (doc) => ({
    title: doc.title,
    pageClass: pageClasses.find((name) => doc.body.classList.contains(name)),
    nodes: [...doc.querySelectorAll('body > .svg-definitions, body > .skip-link, body > .invitation-frame, body > #decline-dialog')],
  });
  let current = capture(document);
  let currentRoute = route(location.pathname);
  let pending = 0;
  routes.set(currentRoute, current);

  async function navigate(url, addHistory) {
    const destination = route(url.pathname);
    const request = ++pending;
    if (destination === currentRoute) return;

    try {
      let next = routes.get(destination);
      if (!next) {
        const response = await fetch(destination);
        if (!response.ok) throw Error('Página indisponível');
        next = capture(new DOMParser().parseFromString(await response.text(), 'text/html'));
        if (!next.pageClass || !next.nodes.some((node) => node.classList.contains('invitation-frame'))) {
          throw Error('Convite indisponível');
        }
        routes.set(destination, next);
      }
      if (request !== pending) return;

      document.querySelector('#decline-dialog[open]')?.close();
      document.body.classList.remove('dialog-open', ...pageClasses);
      document.body.classList.add(next.pageClass);
      current.nodes.forEach((node) => node.remove());
      audio.before(...next.nodes);
      document.title = next.title;
      if (addHistory) history.pushState(null, '', url);
      current = next;
      currentRoute = destination;
      document.dispatchEvent(new Event('invitation:navigate'));
      window.scrollTo({ top: 0, behavior: 'instant' });
      const main = document.querySelector('main');
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    } catch {
      if (request === pending) location.assign(url);
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !route(url.pathname) || url.hash) return;
    event.preventDefault();
    navigate(url, true);
  });

  window.addEventListener('popstate', () => navigate(new URL(location.href), false));
})();
