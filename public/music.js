(() => {
  const audio = document.querySelector('#background-music');
  const fallback = new AbortController();
  const timeKey = 'yasmin-music-time';

  audio.addEventListener('loadedmetadata', () => {
    try {
      const position = Number(sessionStorage.getItem(timeKey));
      if (position > 0 && position < audio.duration) audio.currentTime = position;
    } catch {}
  }, { once: true });

  function play() {
    if (audio.paused) audio.play().catch(() => {});
  }

  function showPlaying() {
    document.body.setAttribute('data-music-playing', '');
    fallback.abort();
  }

  document.addEventListener('click', play, { signal: fallback.signal });
  audio.addEventListener('playing', showPlaying);
  audio.addEventListener('pause', () => document.body.removeAttribute('data-music-playing'));

  window.addEventListener('pagehide', () => {
    try {
      if (audio.currentTime > 0) sessionStorage.setItem(timeKey, String(audio.currentTime));
    } catch {}
  });

  if (audio.paused) play();
  else if (audio.readyState >= 3) showPlaying();
})();
