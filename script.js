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

// --- 3. SINKRONISASI NTP (Multiple Sources untuk Akurasi Tinggi) ---
async function syncNTP() {
    // Helper untuk timeout
    const fetchWithTimeout = (url, options = {}, timeout = 3000) => {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    };

    // Gunakan multiple time sources secara paralel untuk akurasi tinggi
    const timeSources = [
        // WorldTimeAPI - sangat reliable
        async () => {
            try {
                const r = await fetchWithTimeout("https://worldtimeapi.org/api/timezone/Etc/UTC", { cache: "no-store" });
                const d = await r.json();
                return { time: new Date(d.datetime).getTime(), source: 'worldtimeapi' };
            } catch (e) { return null; }
        },
        // HTTPBin untuk timestamp dari header Date
        async () => {
            try {
                const r = await fetchWithTimeout("https://httpbin.org/headers", { cache: "no-store" });
                const dateHeader = r.headers.get('Date');
                return dateHeader ? { time: new Date(dateHeader).getTime(), source: 'httpbin' } : null;
            } catch (e) { return null; }
        },
        // WorldTimeAPI IP endpoint (alternative)
        async () => {
            try {
                const r = await fetchWithTimeout("https://worldtimeapi.org/api/ip", { cache: "no-store" });
                const d = await r.json();
                return { time: new Date(d.datetime).getTime(), source: 'worldtimeapi-ip' };
            } catch (e) { return null; }
        }
    ];

    const results = [];

    // Jalankan semua request secara paralel
    try {
        const promises = timeSources.map(async (fn) => {
            try {
                const requestStart = performance.now();
                const result = await fn();
                const requestEnd = performance.now();
                if (result && result.time) {
                    const latency = (requestEnd - requestStart) / 2;
                    return { ...result, latency, adjustedTime: result.time + latency };
                }
            } catch (e) {
                // Ignore individual failures
            }
            return null;
        });

        const responses = await Promise.allSettled(promises);
        responses.forEach(r => {
            if (r.status === 'fulfilled' && r.value) {
                results.push(r.value);
            }
        });
    } catch (e) {
        console.warn("Sync failed:", e);
    }

    // Gunakan hasil terbaik (rata-rata jika ada multiple sources)
    if (results.length > 0) {
        // Hitung rata-rata untuk akurasi lebih tinggi (menghilangkan outliers)
        const times = results.map(r => r.adjustedTime).sort((a, b) => a - b);
        // Gunakan median jika ada 3+ sources, atau rata-rata jika kurang
        const avgTime = results.length >= 3 
            ? times[Math.floor(times.length / 2)]  // Median lebih robust
            : times.reduce((sum, t) => sum + t, 0) / times.length;  // Average
        
        serverTimeAtSync = Math.round(avgTime);
        perfTimeAtSync = performance.now();
        isSynced = true;
        
        const offset = serverTimeAtSync - Date.now();
        console.log(`✅ NTP Sync Success (${results.length}/${timeSources.length} sources). Offset dari waktu lokal: ${offset.toFixed(0)}ms`);
    } else {
        // Fallback: retry sekali lagi setelah 500ms
        console.warn("⚠️ Sync failed, retrying...");
        setTimeout(() => syncNTP(), 500);
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

// --- 6. INITIALIZATION (Optimized - No Delays) ---
// Langsung eksekusi tanpa menunggu DOMContentLoaded penuh jika elemen sudah ada
loadStorage();
startClock(); // Jalankan jam instan

// Sync NTP immediately (non-blocking) - tanpa delay
syncNTP();

// Defer non-critical operations menggunakan requestIdleCallback (jika tersedia) atau setTimeout
if (window.requestIdleCallback) {
    requestIdleCallback(() => {
        updateVisitor();
        initModalOptions();
    }, { timeout: 1000 });
} else {
    // Fallback untuk browser lama
    setTimeout(() => {
        updateVisitor();
        initModalOptions();
    }, 100);
}

function initModalOptions() {
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
}

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