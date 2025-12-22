// --- 1. CACHE ELEMEN (Optimasi Desktop) ---
// Mencari elemen sekali saja agar browser tidak kerja keras setiap frame
const clockEl = document.getElementById('time-container');
const fillBar = document.getElementById('fill-bar');
const visitorEl = document.getElementById('visitor-count');
const markerContainer = document.getElementById('marker-container');

// --- 2. VARIABEL GLOBAL ---
let globalOffset = 0;
let settings = { msPrecision: 0, isAmPm: false, checkpointType: 'none', checkpointValue: 0 };

// --- 3. ENGINE UTAMA (Optimized) ---
function startClock() {
    // Ambil waktu server (Lokal + Offset)
    const nowServer = new Date(Date.now() + globalOffset);
    
    // Gunakan UTC agar independen dari settingan zona waktu komputer
    let h = nowServer.getUTCHours() + 7;
    if (h >= 24) h -= 24;

    const m = nowServer.getUTCMinutes();
    const s = nowServer.getUTCSeconds();
    const ms = nowServer.getUTCMilliseconds();

    let hDisplay = h;
    let ampm = "";
    if (settings.isAmPm) {
        ampm = h >= 12 ? ' PM' : ' AM';
        hDisplay = h % 12 || 12;
    }

    // Format teks (Gunakan Template Literals agar cepat)
    let timeString = `${String(hDisplay).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    
    // Presisi Milidetik
    if (settings.msPrecision === 1) timeString += "." + Math.floor(ms/100);
    else if (settings.msPrecision === 2) timeString += "." + String(Math.floor(ms/10)).padStart(2, '0');
    
    if (ampm) timeString += ampm;

    // Render ke layar (Hanya jika elemen ada)
    if (clockEl) clockEl.textContent = timeString;

    // Optimasi Fill Bar: Hanya hitung jika sedang di detik ke-9
    if (fillBar) {
        if (s % 10 === 9) {
            fillBar.style.width = (ms / 10) + "%";
        } else if (fillBar.style.width !== "0%") {
            fillBar.style.width = "0%";
        }
    }

    requestAnimationFrame(startClock);
}

// --- 4. SINKRONISASI NTP (Non-Blocking) ---
async function syncTimeWithServer() {
    try {
        const start = performance.now();
        // Pakai WorldTimeAPI atau Cloudflare (CORS friendly)
        const res = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC");
        const data = await res.json();
        const latency = (performance.now() - start) / 2;
        
        const serverUTC = new Date(data.datetime).getTime() + latency;
        globalOffset = serverUTC - Date.now();
        
        console.log("Synced. Offset:", globalOffset, "ms");
    } catch (e) {
        console.warn("Sync failed, using local time.");
    }
}

// --- 5. FUNGSI UI & PENGATURAN ---
function loadFromStorage() {
    try {
        const saved = localStorage.getItem('detikanConfig');
        if (saved) settings = JSON.parse(saved);
    } catch(e) {}
    renderCheckpointMarkers();
}

function renderCheckpointMarkers() {
    if (!markerContainer) return;
    markerContainer.innerHTML = ''; 
    
    if (settings.checkpointType === 'single') {
        const val = settings.checkpointValue;
        createMarker(val * 100, val >= 1.0 ? "0.0" : val.toFixed(1));
    } else if (settings.checkpointType === 'multi') {
        const count = settings.checkpointValue;
        for (let i = 1; i <= count; i++) {
            let val = (1 / count) * i;
            createMarker((100 / count) * i, val >= 1.0 ? "0.0" : val.toFixed(2));
        }
    }
}

function createMarker(percent, label) {
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = percent + '%';
    const s = document.createElement('span');
    s.className = 'marker-label';
    s.textContent = label;
    m.appendChild(s);
    markerContainer.appendChild(m);
}

// --- 6. INITIALIZATION (Fast Boot) ---
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    
    // Bangun opsi modal setelah halaman tampil
    const sc = document.getElementById('single-options');
    if(sc) {
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach(v => {
            let d = document.createElement('div');
            d.className = 'modal-option';
            d.textContent = v === 1.0 ? "0.0" : v.toFixed(1);
            d.onclick = () => setCheckpoint('single', v);
            sc.appendChild(d);
        });
    }

    // Jalankan jam segera
    startClock();
    
    // Jalankan tugas berat setelah jam berjalan
    setTimeout(() => {
        syncTimeWithServer();
        updateVisitorCount();
    }, 500);
});

// Fungsi Reset & Modal tetap sama seperti sebelumnya...
function resetSettings() { openModal('modalReset'); }
function executeReset() { localStorage.removeItem('detikanConfig'); location.reload(); }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }
function closeModal(e) { if(e.target.className === 'modal') closeAllModals(); }
function setMs(p) { settings.msPrecision = p; saveToStorage(); closeAllModals(); }
function toggleTimeMode() { settings.isAmPm = !settings.isAmPm; saveToStorage(); }
function setCheckpoint(type, val) { settings.checkpointType = type; settings.checkpointValue = val; saveToStorage(); closeAllModals(); }
function saveToStorage() { localStorage.setItem('detikanConfig', JSON.stringify(settings)); renderCheckpointMarkers(); }
function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}
async function updateVisitorCount() {
    if (!visitorEl) return;
    try {
        const res = await fetch(`https://api.countapi.xyz/hit/detikan-v4/visits`);
        const data = await res.json();
        visitorEl.textContent = data.value.toLocaleString('id-ID');
    } catch (e) { visitorEl.textContent = "-"; }
}