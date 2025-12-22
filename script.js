// 1. Inisialisasi Variabel Utama (Langsung diisi agar tidak delay)
let baseServerTime = Date.now(); 
let basePerformanceTime = performance.now(); 
let isSynced = false;

let settings = {
    msPrecision: 0,
    isAmPm: false,
    checkpointType: 'none', 
    checkpointValue: 0
};

// --- 2. ENGINE JAM (High Precision) ---
function startClock() {
    // RUMUS: Waktu awal + Durasi sejak halaman dibuka
    const elapsed = performance.now() - basePerformanceTime;
    const nowUTC = new Date(baseServerTime + elapsed);
    
    // Konversi ke WIB (UTC+7)
    let h = nowUTC.getUTCHours() + 7;
    if (h >= 24) h -= 24;

    let m = String(nowUTC.getUTCMinutes()).padStart(2, '0');
    let s = String(nowUTC.getUTCSeconds()).padStart(2, '0');
    let ampm = "";

    // Mode AM/PM
    if (settings.isAmPm) {
        ampm = h >= 12 ? ' PM' : ' AM';
        h = h % 12 || 12;
    }
    const hDisplay = String(h).padStart(2, '0');

    // Milidetik
    let msDisplay = "";
    const ms = nowUTC.getUTCMilliseconds();
    if (settings.msPrecision === 1) msDisplay = "." + Math.floor(ms/100);
    if (settings.msPrecision === 2) msDisplay = "." + String(Math.floor(ms/10)).padStart(2, '0');

    // Update Tampilan Jam
    const clockEl = document.getElementById('time-container');
    if(clockEl) clockEl.innerText = `${hDisplay}:${m}:${s}${msDisplay}${ampm}`;

    // Logic Progress Bar (Muncul tiap detik berakhiran 9)
    const fillBar = document.getElementById('fill-bar');
    if (fillBar) {
        if (nowUTC.getUTCSeconds() % 10 === 9) {
            const progress = (ms / 1000) * 100;
            fillBar.style.width = progress + "%";
        } else {
            fillBar.style.width = "0%";
        }
    }

    requestAnimationFrame(startClock);
}

// --- 3. SINKRONISASI NTP (Latar Belakang) ---
async function syncTimeWithServer() {
    try {
        const startFetch = performance.now();
        // Mengambil waktu UTC dari WorldTimeAPI
        const response = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC", { cache: "no-store" });
        const data = await response.json();
        
        const latency = (performance.now() - startFetch) / 2;
        
        // Update referensi waktu tanpa menghentikan jam
        baseServerTime = new Date(data.datetime).getTime() + latency;
        basePerformanceTime = performance.now();
        isSynced = true;
        
        console.log("NTP Berhasil Sinkron.");
    } catch (err) {
        console.warn("Gagal NTP, tetap menggunakan waktu lokal.");
    }
}

// --- 4. DATA PENGUNJUNG ---
async function updateVisitorCount() {
    const visitorEl = document.getElementById('visitor-count');
    if(!visitorEl) return;
    try {
        const response = await fetch(`https://api.countapi.xyz/hit/jam-presisi-unique-v2/visits`);
        const data = await response.json();
        visitorEl.innerText = data.value.toLocaleString('id-ID');
    } catch (err) {
        visitorEl.innerText = "-";
    }
}

// --- 5. PENGATURAN & LOCAL STORAGE ---
function loadFromStorage() {
    const saved = localStorage.getItem('detikanConfig');
    if (saved) {
        settings = JSON.parse(saved);
    }
    renderCheckpointMarkers();
}

function saveToStorage() {
    localStorage.setItem('detikanConfig', JSON.stringify(settings));
    renderCheckpointMarkers();
}

function executeReset() {
    localStorage.removeItem('detikanConfig');
    location.reload(); 
}

// --- 6. UI & MODAL ---
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
// Fungsi untuk membuka modal saat tombol diklik
function resetSettings() {
    openModal('modalReset');
}

// Fungsi untuk menghapus data saat tombol "Ya, Reset" di dalam modal diklik
function executeReset() {
    localStorage.removeItem('detikanConfig');
    location.reload(); 
}
// --- 7. EKSEKUSI AWAL ---

// Load data & markers
loadFromStorage();

// Generate opsi modal single checkpoint (0.1 - 0.0)
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

// JALANKAN JAM SEKARANG JUGA (INSTAN)
startClock();

// Sinkronkan ke server di latar belakang
syncTimeWithServer();

// Update jumlah pengunjung
updateVisitorCount();