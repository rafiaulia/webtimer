// --- 1. KONFIGURASI GLOBAL ---
let globalOffset = 0; // Selisih milidetik antara server dan lokal
let isSynced = false;

let settings = {
    msPrecision: 0,
    isAmPm: false,
    checkpointType: 'none', 
    checkpointValue: 0
};

// --- 2. SINKRONISASI NTP (METODE OFFSET) ---
// Metode ini menghitung selisih (offset) antara waktu HP dan server
async function syncTimeWithServer() {
    try {
        const startFetch = performance.now();
        const response = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC", { cache: "no-store" });
        const data = await response.json();
        const endFetch = performance.now();
        
        // Menghitung latensi (RTT)
        const latency = (endFetch - startFetch) / 2;
        const serverTimeUTC = new Date(data.datetime).getTime() + latency;
        
        // KUNCI UTAMA: Hitung selisih detik HP dengan server
        // Jika HP lambat 2 menit, globalOffset akan bernilai +120.000ms
        globalOffset = serverTimeUTC - Date.now();
        
        isSynced = true;
        console.log("Sinkronisasi Berhasil. Offset ditemukan:", globalOffset, "ms");
    } catch (err) {
        console.warn("Gagal NTP, menggunakan waktu lokal perangkat.");
    }
}

// --- 3. ENGINE JAM (TIME.IS LOGIC) ---
function startClock() {
    // Ambil waktu HP SAAT INI lalu tambahkan selisih (offset) dari server
    // Ini memastikan waktu yang tampil adalah waktu server sejati
    const nowServer = new Date(Date.now() + globalOffset);
    
    // Konversi manual ke WIB (UTC+7) tanpa peduli zona waktu HP
    let h = nowServer.getUTCHours() + 7;
    if (h >= 24) h -= 24;

    let m = String(nowServer.getUTCMinutes()).padStart(2, '0');
    let s = String(nowServer.getUTCSeconds()).padStart(2, '0');
    let ampm = "";

    if (settings.isAmPm) {
        ampm = h >= 12 ? ' PM' : ' AM';
        h = h % 12 || 12;
    }
    const hDisplay = String(h).padStart(2, '0');

    // Milidetik
    let msDisplay = "";
    const ms = nowServer.getUTCMilliseconds();
    if (settings.msPrecision === 1) msDisplay = "." + Math.floor(ms/100);
    if (settings.msPrecision === 2) msDisplay = "." + String(Math.floor(ms/10)).padStart(2, '0');

    document.getElementById('time-container').innerText = `${hDisplay}:${m}:${s}${msDisplay}${ampm}`;

    // Logic Progress Bar (Setiap detik ke-9)
    const fillBar = document.getElementById('fill-bar');
    if (fillBar) {
        if (nowServer.getUTCSeconds() % 10 === 9) {
            const progress = (ms / 1000) * 100;
            fillBar.style.width = progress + "%";
        } else {
            fillBar.style.width = "0%";
        }
    }

    requestAnimationFrame(startClock);
}

// --- 4. FUNGSI PENDUKUNG (LocalStorage, Modal, UI) ---
function loadFromStorage() {
    const saved = localStorage.getItem('detikanConfig');
    if (saved) settings = JSON.parse(saved);
    renderCheckpointMarkers();
}

function saveToStorage() {
    localStorage.setItem('detikanConfig', JSON.stringify(settings));
    renderCheckpointMarkers();
}

function resetSettings() { openModal('modalReset'); }

function executeReset() {
    localStorage.removeItem('detikanConfig');
    location.reload(); 
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }
function closeModal(e) { if(e.target.className === 'modal') closeAllModals(); }

function setMs(p) { settings.msPrecision = p; saveToStorage(); closeAllModals(); }
function toggleTimeMode() { settings.isAmPm = !settings.isAmPm; saveToStorage(); }
function setCheckpoint(type, val) { settings.checkpointType = type; settings.checkpointValue = val; saveToStorage(); closeAllModals(); }

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

function renderCheckpointMarkers() {
    const container = document.getElementById('marker-container');
    if(!container) return;
    container.innerHTML = ''; 
    if (settings.checkpointType === 'single') {
        let displayVal = settings.checkpointValue >= 1.0 ? "0.0" : settings.checkpointValue.toFixed(1);
        createMarker(settings.checkpointValue * 100, displayVal); 
    } else if (settings.checkpointType === 'multi') {
        const count = settings.checkpointValue;
        for (let i = 1; i <= count; i++) {
            let val = (1 / count) * i;
            let displayVal = val >= 1.0 ? "0.0" : val.toFixed(2);
            createMarker((100 / count) * i, displayVal);
        }
    }
}

function createMarker(percent, label) {
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = percent + '%';
    const span = document.createElement('span');
    span.className = 'marker-label';
    span.innerText = label;
    m.appendChild(span);
    document.getElementById('marker-container').appendChild(m);
}

// --- 5. EKSEKUSI AWAL ---
loadFromStorage();

// Opsi modal single
const sc = document.getElementById('single-options');
if(sc) {
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach(v => {
        let d = document.createElement('div');
        d.className = 'modal-option';
        d.innerText = v === 1.0 ? "0.0" : v.toFixed(1);
        d.onclick = () => setCheckpoint('single', v);
        sc.appendChild(d);
    });
}

// Jalankan jam & Sinkronisasi
startClock();
syncTimeWithServer();

// Pengunjung
async function updateVisitorCount() {
    try {
        const res = await fetch(`https://api.countapi.xyz/hit/jam-presisi-unique-v3/visits`);
        const data = await res.json();
        document.getElementById('visitor-count').innerText = data.value.toLocaleString('id-ID');
    } catch (e) { document.getElementById('visitor-count').innerText = "-"; }
}
updateVisitorCount();