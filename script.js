// Basic interactive film wall logic
let files = []; // list from Apps Script
let currentIndex = 0;
let bgAudio = null;
let audioPlaying = false;

const endpointInput = document.getElementById('endpointInput');
const loadBtn = document.getElementById('loadBtn');
const wall = document.getElementById('wall');
const modal = document.getElementById('modal');
const playerArea = document.getElementById('playerArea');
const closeModal = document.getElementById('closeModal');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const fileTitle = document.getElementById('fileTitle');
const toggleMusic = document.getElementById('toggleMusic');

loadBtn.addEventListener('click', () => {
  const url = endpointInput.value.trim();
  if (!url) return alert('Paste your Apps Script web app URL first.');
  fetchFiles(url);
});

async function fetchFiles(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    files = await res.json();
    if (!Array.isArray(files)) throw new Error('Unexpected JSON');
    renderGrid(files);
    // pick first mp3 as background music
    const mp3 = files.find(f => f.mimeType === 'audio/mpeg' || f.name.toLowerCase().endsWith('.mp3'));
    if (mp3) {
      bgAudio = new Audio(mp3.url);
      bgAudio.loop = true;
      // autoplay blocked: user must interact; we show toggle button to start
      toggleMusic.style.display = 'inline-block';
      toggleMusic.onclick = () => {
        if (!bgAudio) return;
        if (!audioPlaying) {
          bgAudio.play().then(()=>{audioPlaying=true;toggleMusic.textContent='Pause Music'}).catch(()=>alert('Tap any scene to allow audio autoplay.'));
        } else {
          bgAudio.pause(); audioPlaying=false; toggleMusic.textContent='Play Music';
        }
      }
    } else {
      toggleMusic.style.display = 'none';
    }
  } catch (err) {
    alert('Failed to load files: ' + err.message);
    console.error(err);
  }
}

function renderGrid(list){
  wall.innerHTML = '';
  if (list.length === 0) {
    wall.innerHTML = '<p style="opacity:.8">No media found in folder.</p>';
    return;
  }
  list.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.index = i;
    const thumb = document.createElement('img');
    thumb.className='thumb';
    // For video, we still use the view URL — drives usually provide preview — use poster fallback
    if (f.mimeType.startsWith('image/')) {
      thumb.src = f.url;
    } else if (f.mimeType.startsWith('video/')) {
      // try to use poster via drive thumbnail service (not guaranteed) else placeholder
      thumb.src = `https://drive.google.com/thumbnail?id=${f.id}`;
      thumb.onerror = ()=>{ thumb.src = '/placeholder-video.jpg'; }
    } else if (f.mimeType.startsWith('audio/')) {
      thumb.src = '/audio-placeholder.png';
    } else {
      thumb.src = '/file-placeholder.png';
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<div class="name">${escapeHtml(f.name)}</div><div class="type">${f.mimeType}</div>`;
    card.appendChild(thumb);
    card.appendChild(meta);
    card.addEventListener('click', ()=>openModal(parseInt(card.dataset.index)));
    wall.appendChild(card);
  });
}

function openModal(index){
  currentIndex = index;
  showFile(currentIndex);
  modal.classList.remove('hidden');
  // user interaction occurred — allow audio autoplay now
  if (bgAudio && !audioPlaying) {
    bgAudio.play().then(()=>{audioPlaying=true; toggleMusic.textContent='Pause Music'}).catch(()=>{/*ignore*/});
  }
}

closeModal.addEventListener('click', ()=>{ modal.classList.add('hidden'); stopMedia(); });
prevBtn.addEventListener('click', ()=>{ currentIndex = (currentIndex-1+files.length)%files.length; showFile(currentIndex); });
nextBtn.addEventListener('click', ()=>{ currentIndex = (currentIndex+1)%files.length; showFile(currentIndex); });

function showFile(i){
  const f = files[i];
  if (!f) return;
  fileTitle.textContent = f.name;
  playerArea.innerHTML = '';
  if (f.mimeType.startsWith('image/')) {
    const img = document.createElement('img'); img.src = f.url; img.style.maxWidth='100%'; img.style.maxHeight='100%'; img.alt = f.name;
    playerArea.appendChild(img);
  } else if (f.mimeType.startsWith('video/')) {
    const vid = document.createElement('video');
    vid.src = f.url;
    vid.controls = true;
    vid.autoplay = true;
    vid.style.maxWidth='100%'; vid.style.maxHeight='100%';
    playerArea.appendChild(vid);
  } else if (f.mimeType.startsWith('audio/')) {
    const aud = document.createElement('audio');
    aud.src = f.url; aud.controls = true; aud.autoplay = true;
    playerArea.appendChild(aud);
  } else {
    playerArea.textContent = 'Unsupported file type';
  }
}

function stopMedia(){
  // stop/clear players
  const media = playerArea.querySelector('video, audio');
  if (media) { media.pause(); media.src = ''; }
  playerArea.innerHTML = '';
}

// small helper
function escapeHtml(s){ return s.replace(/[&<>"']/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// For convenience: allow pressing Enter to load
endpointInput.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') loadBtn.click(); });
