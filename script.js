/**
 * DETIKAN ENGINE - High Precision NTP Logic
 * Optimized for Instant Load & Cross-Device Sync
 */

/**
 * DETIKAN ENGINE - High Precision NTP Logic
 */

// 1. Variabel Cache & State (Didefinisikan paling atas agar bisa diakses semua fungsi)
let serverTimeAtSync = Date.now(); 
let perfTimeAtSync = performance.now(); 
let isSynced = false;

let settings = { 
    msPrecision: 0, 
    isAmPm: false, 
    checkpointType: 'none', 
    checkpointValue: 0 
};

// --- FITUR TES KLIK (Sudah disesuaikan dengan Engine Utama) ---
window.captureClickTime = function() {
    // Gunakan rumus yang sama dengan startClock agar hasilnya identik dengan jam utama
    const elapsedSinceSync = performance.now() - perfTimeAtSync;
    const now = new Date(serverTimeAtSync + elapsedSinceSync);
    
    // Hitung Jam (WIB)
    let h = now.getUTCHours() + 7;
    if (h >= 24) h -= 24;

    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    
    // Ambil milidetik dan ubah menjadi 2 digit (centiseconds)
    const ms = now.getUTCMilliseconds();
    const cs = String(Math.floor(ms / 10)).padStart(2, '0'); 
    const hDisplay = String(h).padStart(2, '0');

    const finalResult = `${hDisplay}:${m}:${s}:${cs}`;

    // Masukkan ke elemen Hasil
    const targetEl = document.getElementById('hasil-klik');
    if (targetEl) {
        targetEl.textContent = finalResult;
        targetEl.style.color = "#000"; // Ubah warna jadi hitam
    }
};

// Cache Elemen DOM sisanya tetap sama...
const clockEl = document.getElementById('time-container');
const fillBar = document.getElementById('fill-bar');
const visitorEl = document.getElementById('visitor-count');
const markerContainer = document.getElementById('marker-container');



// --- 2. ENGINE UTAMA (Tanpa Jeda) ---
function startClock() {
    // RUMUS EMAS: (Waktu Server Saat Sinkron) + (Durasi sejak sinkron terjadi)
    // Ini menghindari manipulasi Date.now() oleh sistem HP/PC
    const elapsedSinceSync = performance.now() - perfTimeAtSync;
    const now = new Date(serverTimeAtSync + elapsedSinceSync);
    
    // Konversi ke WIB (UTC+7)
    let h = now.getUTCHours() + 7;
    if (h >= 24) h -= 24;

    const m = now.getUTCMinutes();
    const s = now.getUTCSeconds();
    const ms = now.getUTCMilliseconds();

    let hDisplay = h;
    let ampm = "";
    if (settings.isAmPm) {
        ampm = h >= 12 ? ' PM' : ' AM';
        hDisplay = h % 12 || 12;
    }

    // Pembuatan string jam (Efisiensi Tinggi)
    let timeStr = `${String(hDisplay).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    
    if (settings.msPrecision === 1) timeStr += "." + Math.floor(ms/100);
    else if (settings.msPrecision === 2) timeStr += "." + String(Math.floor(ms/10)).padStart(2, '0');
    
    if (ampm) timeStr += ampm;

    // Update Layar
    if (clockEl) clockEl.textContent = timeStr;

    // Logic Fill Bar
    if (fillBar) {
        if (s % 10 === 9) {
            fillBar.style.width = (ms / 10) + "%";
        } else if (fillBar.style.width !== "0%") {
            fillBar.style.width = "0%";
        }
    }

    requestAnimationFrame(startClock);
}

// --- 3. SINKRONISASI NTP (Background Process) ---
async function syncNTP() {
    try {
        const start = performance.now();
        // Menggunakan WorldTimeAPI (CORS Ready & Fast)
        const response = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC", { cache: "no-store" });
        const data = await response.json();
        const end = performance.now();
        
        // Hitung Latensi (Round Trip Time / 2)
        const latency = (end - start) / 2;
        
        // Kunci referensi waktu global
        serverTimeAtSync = new Date(data.datetime).getTime() + latency;
        perfTimeAtSync = performance.now();
        
        isSynced = true;
        console.log("Global Sync Success. Latency:", latency.toFixed(2), "ms");
    } catch (e) {
        console.warn("Sync failed, using device clock.");
    }
}

// --- 4. DATA PENGUNJUNG ---
async function updateVisitor() {
    if (!visitorEl) return;
    try {
        const res = await fetch(`https://api.countapi.xyz/hit/detikan-v5/visits`);
        const data = await res.json();
        visitorEl.textContent = data.value.toLocaleString('id-ID');
    } catch (e) { visitorEl.textContent = "-"; }
}

// --- 5. UI & PENGATURAN ---
function loadStorage() {
    const saved = localStorage.getItem('detikanConfig');
    if (saved) settings = JSON.parse(saved);
    renderMarkers();
}

function renderMarkers() {
    if (!markerContainer) return;
    markerContainer.innerHTML = ''; 
    if (settings.checkpointType === 'single') {
        createMarker(settings.checkpointValue * 100, settings.checkpointValue >= 1.0 ? "0.0" : settings.checkpointValue.toFixed(1));
    } else if (settings.checkpointType === 'multi') {
        const c = settings.checkpointValue;
        for (let i = 1; i <= c; i++) {
            let v = (1 / c) * i;
            createMarker((100 / c) * i, v >= 1.0 ? "0.0" : v.toFixed(2));
        }
    }
}

function createMarker(pct, label) {
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = pct + '%';
    const s = document.createElement('span');
    s.className = 'marker-label';
    s.textContent = label;
    m.appendChild(s);
    markerContainer.appendChild(m);
}

// --- 6. INITIALIZATION (The Fast Path) ---
// Langsung eksekusi tanpa menunggu DOMContentLoaded penuh jika elemen sudah ada
loadStorage();
startClock(); // Jalankan jam instan (pakai waktu lokal dulu)

// Jalankan proses berat di latar belakang agar tidak menghambat load
setTimeout(() => {
    syncNTP();
    updateVisitor();
    
    // Inisialisasi opsi modal
    const sc = document.getElementById('single-options');
    if(sc && sc.children.length === 0) {
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach(v => {
            let d = document.createElement('div');
            d.className = 'modal-option';
            d.textContent = v === 1.0 ? "0.0" : v.toFixed(1);
            d.onclick = () => setCheckpoint('single', v);
            sc.appendChild(d);
        });
    }
}, 300);

// --- FUNGSI GLOBAL (Pastikan tersedia untuk onclick di HTML) ---
window.resetSettings = () => openModal('modalReset');
window.executeReset = () => { localStorage.removeItem('detikanConfig'); location.reload(); };
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeAllModals = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
window.closeModal = (e) => { if(e.target.className === 'modal') closeAllModals(); };
window.setMs = (p) => { settings.msPrecision = p; saveToStorage(); closeAllModals(); };
window.toggleTimeMode = () => { settings.isAmPm = !settings.isAmPm; saveToStorage(); };
window.setCheckpoint = (type, val) => { settings.checkpointType = type; settings.checkpointValue = val; saveToStorage(); closeAllModals(); };
function saveToStorage() { localStorage.setItem('detikanConfig', JSON.stringify(settings)); renderMarkers(); }
window.toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
};