// Cinematic Batch Film — front-end
// Uses your Google Apps Script /exec to fetch folder listing,
// sequences files by filename, cleans captions, plays once.
// ------------------------
// Replace with your Apps Script URL (already set to your working link)
const scriptURL = "https://script.google.com/macros/s/AKfycbzPEcSyqO4Mqo24KeU8RGuf1Di8SqzhjcGgEMd6-yW35fW3tXfTMq3XokBLWqXSjin-/exec";

// UI elements
const splash = document.getElementById('splash');
const startBtn = document.getElementById('startBtn');
const stage = document.getElementById('stage');
const viewport = document.getElementById('viewport');
const captionEl = document.getElementById('caption');
const statusEl = document.getElementById('status');
const pauseBtn = document.getElementById('pauseBtn');
const replayBtn = document.getElementById('replayBtn');
const progressBar = document.getElementById('progressBar');

let playlist = []; // {type:'image'|'video'|'audio', url, title, duration}
let bgMusic = null;
let bgMusicPlaying = false;
let current = 0;
let playing = false;
let paused = false;
let runStart = 0;
let totalDuration = 0;

startBtn.addEventListener('click', startSequence);
pauseBtn.addEventListener('click', togglePause);
replayBtn.addEventListener('click', replayFilm);

async function startSequence() {
  startBtn.disabled = true;
  startBtn.textContent = 'LOADING...';
  try {
    const fetched = await fetchAndBuild();
    if (!fetched) throw new Error('No playable media found.');
    // hide splash, show stage
    splash.classList.add('hidden');
    stage.classList.remove('hidden');
    // start music if present
    if (bgMusic) {
      try {
        await bgMusic.play();
        bgMusicPlaying = true;
      } catch {
        // some browsers block autoplay; user has clicked already (should allow)
        bgMusicPlaying = false;
      }
    }
    // start playing the sequence
    runStart = performance.now();
    playing = true;
    paused = false;
    current = 0;
    totalDuration = playlist.reduce((s, p) => s + (p.duration || 0), 0);
    playNext();
  } catch (err) {
    console.error(err);
    alert('Failed to start film: ' + err.message);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = 'PLAY FILM';
  }
}

async function fetchAndBuild() {
  statusEl.textContent = 'Fetching drive listing...';
  const res = await fetch(scriptURL);
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const files = await res.json();
  console.log('Fetched', files.length, 'files from Drive.');

  // filter supported types (image/video/audio)
  const supported = files.filter(f => {
    if (!f || !f.mimeType) return false;
    return f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/') || f.mimeType.startsWith('audio/');
  });

  if (supported.length === 0) return false;

  // sort by filename (numbers aware)
  supported.sort((a,b)=> a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'}));

  // pick first MP3 as background music (optional)
  const firstMP3 = supported.find(f => f.mimeType === 'audio/mpeg' || /\.mp3$/i.test(f.name));
  if (firstMP3) {
    bgMusic = new Audio(firstMP3.url);
    bgMusic.loop = true;
    bgMusic.volume = 0.55;
  }

  // build playlist: skip background MP3 from visual sequence
  playlist = supported.filter(f => !(firstMP3 && f.id === firstMP3.id)).map(f => {
    const type = f.mimeType.startsWith('image/') ? 'image' : f.mimeType.startsWith('video/') ? 'video' : 'audio';
    const title = cleanTitle(f.name);
    // duration guess: videos we don't know until loaded; for images use 4000ms
    return { id: f.id, type, url: f.url, name: f.name, title, duration: type === 'image' ? 4000 : 0 };
  });

  // preload small number of items & compute video durations asynchronously
  statusEl.textContent = 'Preparing media...';
  await computeDurations(playlist);

  statusEl.textContent = `Ready — ${playlist.length} scenes`;
  return true;
}

function cleanTitle(filename) {
  // remove leading numbers and separators, remove extension, replace _ and - with spaces, trim
  let name = filename.replace(/\.[^/.]+$/, ''); // remove extension
  name = name.replace(/^[0-9\-\._\s]+/, ''); // remove leading numbers/underscores/hyphens/dots
  name = name.replace(/[_\-]+/g, ' '); // underscores/hyphens -> spaces
  name = name.trim();
  if (!name) return 'Scene';
  return name;
}

function computeDurations(list) {
  // returns when all durations known (images already set)
  const promises = list.map((item, idx) => {
    if (item.type === 'image') return Promise.resolve();
    if (item.type === 'audio') {
      // audio visual item: use audio duration if available
      return new Promise(resolve => {
        const a = document.createElement('audio');
        a.src = item.url;
        a.addEventListener('loadedmetadata', () => { item.duration = Math.round(a.duration * 1000); resolve(); });
        a.addEventListener('error', ()=> { item.duration = 3000; resolve(); });
      });
    }
    if (item.type === 'video') {
      return new Promise(resolve => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.src = item.url;
        v.addEventListener('loadedmetadata', () => {
          // video duration in ms
          item.duration = Math.round(v.duration * 1000);
          // if duration too short, give fallback
          if (!item.duration || item.duration < 800) item.duration = 3000;
          resolve();
        });
        v.addEventListener('error', () => {
          item.duration = 3000;
          resolve();
        });
      });
    }
  });
  return Promise.all(promises);
}

function playNext() {
  if (!playing) return;
  if (current >= playlist.length) {
    // film ended
    filmEnded();
    return;
  }
  const item = playlist[current];
  statusEl.textContent = `Playing ${current+1} / ${playlist.length}`;
  showItem(item).then(() => {
    current++;
    updateProgress();
    if (playing && !paused) playNext();
  });
}

function showItem(item) {
  return new Promise(async (resolve) => {
    // clear viewport
    clearViewport();
    captionEl.textContent = item.title || '';

    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.title;
      viewport.appendChild(img);
      // show
      await fadeInElement(img);
      // wait for duration or until paused
      await waitMs(item.duration, () => paused);
      await fadeOutElement(img);
      img.remove();
      resolve();
    } else if (item.type === 'video') {
      const vid = document.createElement('video');
      vid.src = item.url;
      vid.controls = false;
      vid.autoplay = true;
      vid.preload = 'auto';
      vid.playsInline = true;
      viewport.appendChild(vid);
      // wait until canplaythen play
      vid.addEventListener('canplay', async function once() {
        vid.removeEventListener('canplay', once);
        await fadeInElement(vid);
        // play (ensured user gesture on start)
        try { await vid.play(); } catch(e) { console.warn('video play blocked', e); }
        // wait for ended or pause
        vid.addEventListener('ended', async () => {
          await fadeOutElement(vid);
          vid.remove();
          resolve();
        });
        vid.addEventListener('error', async () => {
          await fadeOutElement(vid);
          vid.remove();
          resolve();
        });
      });
    } else if (item.type === 'audio') {
      // visualizer: show a simple placeholder and play audio for its duration
      const blk = document.createElement('div');
      blk.style.width = '80%';
      blk.style.height = '60%';
      blk.style.borderRadius = '10px';
      blk.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))';
      viewport.appendChild(blk);
      await fadeInElement(blk);
      // play audio element
      const a = document.createElement('audio');
      a.src = item.url;
      a.autoplay = true;
      a.preload = 'auto';
      try { await a.play(); } catch(e) { console.warn('audio play blocked', e); }
      // wait for end / duration
      a.addEventListener('ended', async () => {
        await fadeOutElement(blk);
        blk.remove();
        resolve();
      });
      a.addEventListener('error', async () => {
        await fadeOutElement(blk);
        blk.remove();
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function clearViewport() {
  // remove all non-caption children
  Array.from(viewport.children).forEach(node => {
    if (node.id === 'caption') return;
    node.remove();
  });
}

function fadeInElement(el) {
  return new Promise(res => {
    requestAnimationFrame(() => {
      el.classList.add('show');
      // small transform for subtle zoom
      el.style.transform = 'translate(-50%,-50%) scale(1.02)';
      setTimeout(()=>res(), 900);
    });
  });
}
function fadeOutElement(el) {
  return new Promise(res => {
    requestAnimationFrame(() => {
      el.classList.remove('show');
      el.style.transform = 'translate(-50%,-50%) scale(1.00)';
      setTimeout(()=>res(), 900);
    });
  });
}

function waitMs(ms, stopIf) {
  return new Promise(resolve => {
    const start = performance.now();
    function tick() {
      if (stopIf && stopIf()) {
        // wait until resumed
        setTimeout(tick, 300);
        return;
      }
      const elapsed = performance.now() - start;
      if (elapsed >= ms) return resolve();
      requestAnimationFrame(tick);
    }
    tick();
  });
}

function updateProgress() {
  const elapsed = playlist.slice(0, current).reduce((s,p)=> s + (p.duration||0), 0);
  const pct = totalDuration ? Math.min(100, Math.round((elapsed / totalDuration) * 100)) : 0;
  progressBar.style.width = pct + '%';
  // update status text with time
  statusEl.textContent = `Scene ${Math.min(current+1, playlist.length)} / ${playlist.length}`;
}

function togglePause() {
  if (!playing) return;
  paused = !paused;
  if (paused) {
    pauseBtn.textContent = 'Resume';
    // pause background music & any playing video
    if (bgMusic && !bgMusic.paused) bgMusic.pause();
    const media = viewport.querySelector('video, audio');
    if (media && !media.paused) try{ media.pause(); }catch{}
    statusEl.textContent = 'Paused';
  } else {
    pauseBtn.textContent = 'Pause';
    if (bgMusic && bgMusic.paused) try{ bgMusic.play(); }catch{}
    const media = viewport.querySelector('video, audio');
    if (media && media.paused) try{ media.play(); }catch{}
    statusEl.textContent = `Resumed — Scene ${current+1} / ${playlist.length}`;
    // resume sequence by calling playNext if waiting for waitMs
    if (playing) playNext();
  }
}

function filmEnded() {
  playing = false;
  paused = false;
  statusEl.textContent = 'The End';
  progressBar.style.width = '100%';
  // show replay
  replayBtn.classList.remove('hidden');
  // stop bg music
  if (bgMusic && !bgMusic.paused) try{ bgMusic.pause(); bgMusic.currentTime = 0; }catch{}
  // show credit caption
  captionEl.textContent = 'Thank you, Batch — The End';
  // attach replay behavior
  replayBtn.onclick = () => {
    replayBtn.classList.add('hidden');
    captionEl.textContent = '';
    playAgain();
  };
}

function playAgain() {
  // restart everything
  current = 0;
  totalDuration = playlist.reduce((s,p) => s + (p.duration||0), 0);
  progressBar.style.width = '0%';
  if (bgMusic) try{ bgMusic.play(); }catch{}
  playing = true;
  playNext();
}

// quick debug: show counts in console
console.log('Script loaded. Prepped to fetch:', scriptURL);

// expose a small runner if someone wants to start via console
window.__filmRunner = { startSequence, fetchAndBuild };

