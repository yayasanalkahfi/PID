// ===================================
// MID — APLIKASI UTAMA
// Firebase Authentication + Cloud Firestore
// ===================================

// ===================================
// KONFIGURASI FIREBASE
// ===================================

const firebaseConfig = {
    apiKey: "AIzaSyBwGFot85xHAFK80acOeIZVGvL3CfU7cZw",
    authDomain: "mid-manajemeninformasidakwah.firebaseapp.com",
    projectId: "mid-manajemeninformasidakwah",
    storageBucket: "mid-manajemeninformasidakwah.firebasestorage.app",
    messagingSenderId: "1020695409745",
    appId: "1:1020695409745:web:c0be91a93adc3cc52ef470",
    measurementId: "G-CRJYSM6BE9"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const MEMBERS_COLLECTION = "members";
const EVENTS_COLLECTION = "events";
const ADMINS_COLLECTION = "admins";

let currentUser = null;
let members = [];
let events = [];
let eventPosterObjectURLs = [];
let firebaseReady = false;

// ===================================
// KONFIGURASI HALAMAN
// ===================================

const pages = {
    dashboard: { title: "Dashboard", description: "Ringkasan aktivitas organisasi MID" },
    anggota: { title: "Data Anggota", description: "Manajemen data keanggotaan" },
    kegiatan: { title: "Kegiatan", description: "Manajemen kegiatan organisasi" },
    pendaftaran: { title: "Pendaftaran", description: "Persetujuan peserta kegiatan" },
    presensi: { title: "Presensi", description: "Pemantauan kehadiran kegiatan" },
    angket: { title: "Angket", description: "Pengelolaan survei kegiatan" },
    kaderisasi: { title: "Kaderisasi", description: "Evaluasi perkembangan anggota" },
    susulan: { title: "Kegiatan Susulan", description: "Pengelolaan kegiatan pengganti" },
    "laporan-organisasi": { title: "Laporan Organisasi", description: "Monitoring perkembangan organisasi" },
    "laporan-anggota": { title: "Laporan Anggota", description: "Monitoring perkembangan individu" },
    "ekspor-angket": { title: "Ekspor Angket", description: "Unduh hasil survei internal" },
    artikel: { title: "Artikel", description: "Manajemen artikel" },
    program: { title: "Program", description: "Manajemen program organisasi" },
    galeri: { title: "Galeri", description: "Dokumentasi kegiatan" },
    sistem: { title: "Pengaturan Sistem", description: "Konfigurasi aplikasi" },
    admin: { title: "Administrator", description: "Manajemen administrator" }
};

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");

const eventCategories = [
    "Keislaman", "Kepemimpinan", "Komunikasi Dakwah",
    "Sosial", "Intelektual", "Lainnya"
];

const EVENT_LEVEL_ORDER = { T1: 1, T2: 2, T3: 3 };

// ===================================
// FIRESTORE — DATA ANGGOTA
// ===================================

async function loadMembers() {
    const snapshot = await db.collection(MEMBERS_COLLECTION).get();
    members = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return members;
}

async function saveMemberToFirestore(member) {
    const cleanMember = { ...member, id: String(member.id) };
    await db.collection(MEMBERS_COLLECTION).doc(String(member.id)).set(cleanMember);
    return true;
}

async function deleteMemberFromFirestore(memberId) {
    await db.collection(MEMBERS_COLLECTION).doc(String(memberId)).delete();
}

// ===================================
// FIRESTORE — DATA KEGIATAN
// ===================================

async function loadEvents() {
    const snapshot = await db.collection(EVENTS_COLLECTION).get();
    events = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return events;
}

async function saveEventToFirestore(event) {
    const cleanEvent = { ...event, id: String(event.id) };
    await db.collection(EVENTS_COLLECTION).doc(String(event.id)).set(cleanEvent);
    return true;
}

async function deleteEventFromFirestore(eventId) {
    await db.collection(EVENTS_COLLECTION).doc(String(eventId)).delete();
}

// ===================================
// PENYIMPANAN POSTER (INDEXEDDB)
// Catatan: poster masih tersimpan pada perangkat ini.
// ===================================

const POSTER_DB_NAME = "mid_poster_database";
const POSTER_STORE_NAME = "event_posters";

function openPosterDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(POSTER_DB_NAME, 1);
        request.onupgradeneeded = event => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(POSTER_STORE_NAME)) {
                database.createObjectStore(POSTER_STORE_NAME);
            }
        };
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveEventPoster(file, posterKey) {
    const database = await openPosterDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(POSTER_STORE_NAME, "readwrite");
        transaction.objectStore(POSTER_STORE_NAME).put(file, posterKey);
        transaction.oncomplete = () => { database.close(); resolve(posterKey); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
        transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
}

async function getEventPoster(posterKey) {
    const database = await openPosterDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(POSTER_STORE_NAME, "readonly");
        const request = transaction.objectStore(POSTER_STORE_NAME).get(posterKey);
        request.onsuccess = () => { const result = request.result; database.close(); resolve(result || null); };
        request.onerror = () => { database.close(); reject(request.error); };
    });
}

async function deleteEventPoster(posterKey) {
    const database = await openPosterDB();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(POSTER_STORE_NAME, "readwrite");
        transaction.objectStore(POSTER_STORE_NAME).delete(posterKey);
        transaction.oncomplete = () => { database.close(); resolve(true); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
        transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
}

function clearPosterObjectURLs() {
    eventPosterObjectURLs.forEach(url => URL.revokeObjectURL(url));
    eventPosterObjectURLs = [];
}

// ===================================
// FUNGSI UMUM
// ===================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function getToday() {
    return new Date().toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
}

function formatDate(date) {
    if (!date) return "-";
    const parsed = new Date(date + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric"
    });
}

function generateMemberNumber() {
    const year = new Date().getFullYear();
    const prefix = `MID-${year}-`;
    const numbers = members
        .filter(member => String(member.number || "").startsWith(prefix))
        .map(member => parseInt(String(member.number).split("-")[2], 10))
        .filter(number => Number.isFinite(number));
    return prefix + String(Math.max(0, ...numbers) + 1).padStart(3, "0");
}

function getMemberById(id) {
    return members.find(member => String(member.id) === String(id));
}

function getEventById(id) {
    return events.find(event => String(event.id) === String(id));
}

function showLoading(message = "Memuat data...") {
    const content = document.getElementById("pageContent");
    if (content) content.innerHTML = `<div class="dashboard-note">${escapeHTML(message)}</div>`;
}

// ===================================
// ATURAN AKSES DAN VALIDASI KEGIATAN
// ===================================

function canMemberViewEvent(member, event) {
    if (!member || !event || member.status !== "Aktif") return false;
    const memberLevel = EVENT_LEVEL_ORDER[member.level];
    const minimumLevel = EVENT_LEVEL_ORDER[event.visibility];
    return Boolean(memberLevel && minimumLevel && memberLevel >= minimumLevel);
}

function canMemberJoinEvent(member, event) {
    if (!member || !event || member.status !== "Aktif") return false;
    const eligibleLevels = Array.isArray(event.eligibleLevels) ? event.eligibleLevels : [];
    return eligibleLevels.includes(member.level);
}

function canMemberRegisterEvent(member, event) {
    return canMemberViewEvent(member, event) && canMemberJoinEvent(member, event);
}

function getEventVisibilityLabel(visibility) {
    return ({
        T1: "Semua Tingkat (T1–T3)",
        T2: "Tingkat 2 dan 3",
        T3: "Tingkat 3 saja"
    })[visibility] || "Belum diatur";
}

function getEventRegistrationState(event, now = new Date()) {
    if (!event) return "Tidak tersedia";
    if (event.status !== "Dibuka") return event.status || "Belum ditentukan";
    if (!event.registrationStart || !event.registrationEnd) return "Jadwal belum valid";

    const start = new Date(event.registrationStart);
    const end = new Date(event.registrationEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return "Jadwal belum valid";
    }
    if (now < start) return "Belum Dibuka";
    if (now >= end) return "Ditutup";
    return "Pendaftaran Aktif";
}

function validateEventForm(form) {
    const data = new FormData(form);
    const date = data.get("date");
    const startTime = data.get("startTime");
    const endTime = data.get("endTime");
    const registrationStart = new Date(data.get("registrationStart"));
    const registrationEnd = new Date(data.get("registrationEnd"));
    const quota = Number(data.get("quota"));
    const eligibleLevels = Array.from(
        form.querySelectorAll('input[name="eligibleLevels"]:checked')
    ).map(input => input.value);

    if (!date || !startTime || !endTime) return "Tanggal dan waktu kegiatan harus dilengkapi.";
    const eventStart = new Date(`${date}T${startTime}`);
    const eventEnd = new Date(`${date}T${endTime}`);
    if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) return "Tanggal atau waktu kegiatan tidak valid.";
    if (eventEnd <= eventStart) return "Waktu selesai harus lebih besar dari waktu mulai.";
    if (Number.isNaN(registrationStart.getTime()) || Number.isNaN(registrationEnd.getTime())) return "Jadwal pendaftaran belum lengkap atau tidak valid.";
    if (registrationEnd <= registrationStart) return "Waktu penutupan pendaftaran harus setelah waktu pembukaan.";
    if (registrationEnd > eventStart) return "Pendaftaran harus ditutup sebelum kegiatan dimulai.";
    if (!Number.isInteger(quota) || quota < 1) return "Kuota peserta minimal 1 orang.";
    if (!eligibleLevels.length) return "Pilih minimal satu tingkat anggota yang boleh mengikuti kegiatan.";
    if (!EVENT_LEVEL_ORDER[data.get("visibility")]) return "Visibilitas kegiatan belum ditentukan.";
    if (!data.get("title")?.trim()) return "Nama kegiatan harus diisi.";
    if (!data.get("location")?.trim()) return "Lokasi kegiatan harus diisi.";
    return null;
}

// ===================================
// DASHBOARD
// ===================================

function renderAdminDashboard() {
    document.getElementById("panelTitle").textContent = "Ringkasan Organisasi";
    document.getElementById("panelDescription").textContent = "Pantau perkembangan dan aktivitas organisasi MID.";
    document.getElementById("dashboardStats").style.display = "grid";

    const totalT1 = members.filter(m => m.level === "T1" && m.status === "Aktif").length;
    const totalT2 = members.filter(m => m.level === "T2" && m.status === "Aktif").length;
    const totalT3 = members.filter(m => m.level === "T3" && m.status === "Aktif").length;
    const activeMembers = members.filter(member => member.status === "Aktif").length;

    const upcomingEvents = events.filter(event => {
        const date = new Date(`${event.date}T${event.startTime || "00:00"}`);
        return event.status !== "Dibatalkan" && event.status !== "Selesai" &&
            !Number.isNaN(date.getTime()) && date >= new Date();
    }).length;
    const completedEvents = events.filter(event => event.status === "Selesai").length;

    document.getElementById("pageContent").innerHTML = `
        <div class="dashboard-welcome">
            <div><span class="welcome-label">ADMINISTRATOR MID</span>
                <h2>Selamat datang kembali!</h2>
                <p>Berikut gambaran umum aktivitas organisasi Anda.</p></div>
            <div class="welcome-date">${getToday()}</div>
        </div>
        <div class="dashboard-section">
            <div class="section-heading"><div><h3>Komposisi Keanggotaan</h3>
                <p>Distribusi anggota aktif berdasarkan tingkat kaderisasi</p></div></div>
            <div class="level-grid">
                <div class="level-card level-one"><span>Tingkat 1</span><strong>${totalT1}</strong><small>Anggota T1</small></div>
                <div class="level-card level-two"><span>Tingkat 2</span><strong>${totalT2}</strong><small>Anggota T2</small></div>
                <div class="level-card level-three"><span>Tingkat 3</span><strong>${totalT3}</strong><small>Anggota T3</small></div>
            </div>
        </div>
        <div class="dashboard-section">
            <div class="section-heading"><div><h3>Aktivitas Kegiatan</h3><p>Gambaran pelaksanaan kegiatan organisasi</p></div></div>
            <div class="activity-grid">
                <div class="activity-card"><span>Kegiatan Mendatang</span><strong>${upcomingEvents}</strong></div>
                <div class="activity-card"><span>Kegiatan Terlaksana</span><strong>${completedEvents}</strong></div>
                <div class="activity-card"><span>Total Partisipasi</span><strong>0</strong></div>
            </div>
        </div>
        <div class="dashboard-section">
            <div class="section-heading"><div><h3>Perkembangan Organisasi</h3><p>Visualisasi perkembangan anggota dan kegiatan</p></div></div>
            <div class="chart-placeholder"><div class="chart-icon">▥</div>
                <strong>Grafik Perkembangan MID</strong><p>Grafik akan ditampilkan setelah modul monitoring tersedia.</p></div>
        </div>
        <div class="dashboard-section">
            <div class="section-heading"><div><h3>Perlu Perhatian</h3><p>Informasi yang membutuhkan tindak lanjut administrator</p></div></div>
            <div class="attention-list">
                <div class="attention-item"><span class="attention-dot"></span><div><strong>Pendaftaran Anggota</strong><p>Belum ada data pendaftaran yang ditampilkan.</p></div><span class="attention-number">0</span></div>
                <div class="attention-item"><span class="attention-dot gold"></span><div><strong>Evaluasi Kaderisasi</strong><p>Data evaluasi akan tersedia setelah kegiatan berjalan.</p></div><span class="attention-number">0</span></div>
            </div>
        </div>
        <div class="dashboard-note"><strong>Status penyimpanan</strong>
            <p>Data anggota dan kegiatan tersimpan di Firebase Cloud Firestore. File poster masih tersimpan lokal pada perangkat ini.</p></div>
    `;

    const stats = document.querySelectorAll(".stat-card h2");
    if (stats.length >= 4) {
        stats[0].textContent = members.length;
        stats[1].textContent = events.length;
        stats[2].textContent = activeMembers;
        stats[3].textContent = 0;
    }
}

// ===================================
// KEGIATAN — DAFTAR DAN FILTER
// ===================================

function renderEvents() {
    clearPosterObjectURLs();
    const content = document.getElementById("pageContent");
    content.innerHTML = `
        <div class="member-toolbar"><div><h3>Daftar Kegiatan MID</h3><p>Kelola dan pantau seluruh kegiatan organisasi.</p></div>
            <button class="member-add-button" onclick="renderAddEventForm()">+ Tambah Kegiatan</button></div>
        <div class="member-filters">
            <input type="search" id="eventSearch" placeholder="Cari nama kegiatan...">
            <select id="eventStatusFilter">
                <option value="">Semua Status</option><option value="Draft">Draft</option>
                <option value="Dibuka">Pendaftaran Dibuka</option><option value="Berlangsung">Berlangsung</option>
                <option value="Selesai">Selesai</option><option value="Dibatalkan">Dibatalkan</option>
            </select>
        </div>
        <div class="member-summary"><span id="eventCount">0 kegiatan ditemukan</span></div>
        <div class="member-table-wrap"><table class="member-table">
            <thead><tr><th>Poster</th><th>Nama Kegiatan</th><th>Tanggal</th><th>Kategori</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody id="eventTableBody"></tbody>
        </table></div>`;

    document.getElementById("eventSearch").addEventListener("input", filterEvents);
    document.getElementById("eventStatusFilter").addEventListener("change", filterEvents);
    filterEvents();
}

async function filterEvents() {
    const searchInput = document.getElementById("eventSearch");
    const statusFilter = document.getElementById("eventStatusFilter");
    const tbody = document.getElementById("eventTableBody");
    const count = document.getElementById("eventCount");
    if (!searchInput || !statusFilter || !tbody || !count) return;

    clearPosterObjectURLs();
    const search = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const filtered = events.filter(event =>
        (event.title || "").toLowerCase().includes(search) &&
        (!status || event.status === status)
    );
    count.textContent = `${filtered.length} kegiatan ditemukan`;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="member-empty">Belum ada kegiatan yang sesuai.</td></tr>`;
        return;
    }

    const rows = await Promise.all(filtered.map(async event => {
        let posterHTML = `<div style="width:90px;height:110px;background:linear-gradient(135deg,#211B63,#5141A5,#F4BD50)"></div>`;
        if (event.posterKey) {
            try {
                const poster = await getEventPoster(event.posterKey);
                if (poster) {
                    const url = URL.createObjectURL(poster);
                    eventPosterObjectURLs.push(url);
                    posterHTML = `<img src="${url}" alt="Poster ${escapeHTML(event.title)}" style="display:block;width:auto;height:auto;max-width:110px;max-height:140px;object-fit:contain">`;
                }
            } catch (error) { console.error("Gagal memuat poster:", error); }
        }
        return `<tr>
            <td>${posterHTML}</td>
            <td><button type="button" onclick="renderEventDetail('${escapeHTML(event.id)}')" style="border:0;background:none;padding:0;color:#211B63;font-weight:700;text-align:left;cursor:pointer">${escapeHTML(event.title)}</button></td>
            <td>${formatDate(event.date)}</td><td>${escapeHTML(event.category || "-")}</td>
            <td><div>${escapeHTML(event.status || "-")}</div><small>${escapeHTML(getEventRegistrationState(event))}</small></td>
            <td><button type="button" class="member-detail-button" onclick="deleteEvent('${escapeHTML(event.id)}')" style="background:#b42318;color:white">Hapus</button></td>
        </tr>`;
    }));
    tbody.innerHTML = rows.join("");
}

// ===================================
// KEGIATAN — FORM TAMBAH
// ===================================

function renderAddEventForm() {
    const content = document.getElementById("pageContent");
    content.innerHTML = `
        <div class="member-form-header"><button class="member-back-button" onclick="renderEvents()">← Kembali ke Daftar</button>
            <h3>Tambah Kegiatan Baru</h3><p>Lengkapi informasi dan pengaturan kegiatan MID.</p></div>
        <form id="addEventForm" class="member-form">
            <div class="member-form-section"><h4>A. Informasi Kegiatan</h4><div class="member-form-grid">
                <div class="member-form-field full"><label>Nama Kegiatan *</label><input type="text" name="title" required></div>
                <div class="member-form-field"><label>Kategori Kegiatan *</label><select name="category" required><option value="">Pilih kategori</option>${eventCategories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("")}</select></div>
                <div class="member-form-field full"><label>Deskripsi Kegiatan *</label><textarea name="description" rows="4" required></textarea></div>
            </div></div>
            <div class="member-form-section"><h4>Poster / Flyer Kegiatan</h4><div class="member-form-grid">
                <div class="member-form-field full"><label>Unggah Poster (Opsional)</label><input type="file" id="eventPoster" accept="image/jpeg,image/png,image/webp"><small>Format JPG, PNG, atau WEBP. Maksimal 2 MB.</small></div>
                <div class="member-form-field full"><label>Pratinjau Poster</label>
                    <div id="eventPosterPreview" style="width:100%;min-height:240px;background:linear-gradient(135deg,#211B63,#5141A5,#F4BD50);display:flex;align-items:center;justify-content:center;overflow:hidden">
                        <img id="eventPosterImage" alt="Pratinjau poster kegiatan" style="display:none;max-width:100%;max-height:420px;width:auto;height:auto;object-fit:contain">
                    </div><small>Poster ditampilkan tanpa crop atau lapisan penutup.</small>
                </div>
            </div></div>
            <div class="member-form-section"><h4>B. Waktu dan Lokasi</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Tanggal Kegiatan *</label><input type="date" name="date" required></div>
                <div class="member-form-field"><label>Waktu Mulai *</label><input type="time" name="startTime" required></div>
                <div class="member-form-field"><label>Waktu Selesai *</label><input type="time" name="endTime" required></div>
                <div class="member-form-field full"><label>Lokasi Kegiatan *</label><input type="text" name="location" required></div>
            </div></div>
            <div class="member-form-section"><h4>C. Pengaturan Pendaftaran</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Kuota Peserta *</label><input type="number" name="quota" min="1" step="1" required></div>
                <div class="member-form-field"><label>Pendaftaran Dibuka *</label><input type="datetime-local" name="registrationStart" required></div>
                <div class="member-form-field"><label>Pendaftaran Ditutup *</label><input type="datetime-local" name="registrationEnd" required></div>
            </div></div>
            <div class="member-form-section"><h4>D. Akses dan Kelayakan Peserta</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Visibilitas Kegiatan *</label><select name="visibility" required><option value="T1">T1 ke atas (Semua Anggota)</option><option value="T2">T2 ke atas</option><option value="T3">T3 saja</option></select><small>Mengatur siapa yang dapat melihat kegiatan.</small></div>
                <div class="member-form-field full"><label>Tingkat Anggota yang Boleh Mengikuti *</label>
                    <label><input type="checkbox" name="eligibleLevels" value="T1" checked> Tingkat 1 (T1)</label>
                    <label><input type="checkbox" name="eligibleLevels" value="T2" checked> Tingkat 2 (T2)</label>
                    <label><input type="checkbox" name="eligibleLevels" value="T3" checked> Tingkat 3 (T3)</label>
                    <small>Pengaturan ini terpisah dari visibilitas.</small></div>
            </div></div>
            <div class="member-form-section"><h4>E. Pengaturan Kaderisasi dan Status</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Pengaruh terhadap Kaderisasi *</label><select name="requirement" required><option value="non_required">Tidak Wajib</option><option value="required">Kegiatan Wajib</option></select></div>
                <div class="member-form-field"><label>Status Awal *</label><select name="status" required><option value="Draft">Draft</option><option value="Dibuka">Pendaftaran Dibuka</option></select></div>
            </div></div>
            <div class="member-form-actions"><button type="button" class="member-cancel-button" onclick="renderEvents()">Batal</button><button type="submit" class="member-save-button">Simpan Kegiatan</button></div>
        </form>`;

    let selectedPoster = null;
    const input = document.getElementById("eventPoster");
    const image = document.getElementById("eventPosterImage");
    const preview = document.getElementById("eventPosterPreview");

    input.addEventListener("change", function() {
        const file = this.files[0];
        if (!file) { selectedPoster = null; image.style.display = "none"; return; }
        if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            alert("Gunakan gambar JPG, PNG, atau WEBP maksimal 2 MB.");
            this.value = ""; selectedPoster = null; image.style.display = "none"; return;
        }
        selectedPoster = file;
        const reader = new FileReader();
        reader.onload = event => { image.src = event.target.result; image.style.display = "block"; preview.style.background = "transparent"; };
        reader.readAsDataURL(file);
    });

    document.getElementById("addEventForm").addEventListener("submit", async function(event) {
        event.preventDefault();
        const form = this;
        const button = form.querySelector('button[type="submit"]');
        const error = validateEventForm(form);
        if (error) { alert(error); return; }
        button.disabled = true; button.textContent = "Menyimpan...";
        let posterKey = null;
        try {
            const data = new FormData(form);
            const id = "EVT-" + Date.now();
            if (selectedPoster) {
                posterKey = "POSTER-" + id;
                await saveEventPoster(selectedPoster, posterKey);
            }
            const newEvent = {
                id, title: data.get("title").trim(), category: data.get("category"),
                description: data.get("description").trim(), date: data.get("date"),
                startTime: data.get("startTime"), endTime: data.get("endTime"),
                location: data.get("location").trim(), quota: Number(data.get("quota")),
                registrationStart: data.get("registrationStart"), registrationEnd: data.get("registrationEnd"),
                visibility: data.get("visibility"),
                eligibleLevels: Array.from(form.querySelectorAll('input[name="eligibleLevels"]:checked')).map(item => item.value),
                requirement: data.get("requirement"), status: data.get("status"),
                posterKey, createdAt: new Date().toISOString()
            };
            await saveEventToFirestore(newEvent);
            events.push(newEvent);
            alert("Kegiatan berhasil disimpan!");
            renderEvents();
        } catch (error) {
            console.error("Gagal menyimpan kegiatan:", error);
            if (posterKey) { try { await deleteEventPoster(posterKey); } catch (e) { console.error(e); } }
            button.disabled = false; button.textContent = "Simpan Kegiatan";
            alert("Kegiatan gagal disimpan. Periksa koneksi dan aturan Firestore.");
        }
    });
}

// ===================================
// KEGIATAN — FORM EDIT
// ===================================

async function renderEditEventForm(eventId) {
    const event = getEventById(eventId);
    if (!event) { alert("Kegiatan tidak ditemukan."); renderEvents(); return; }
    const content = document.getElementById("pageContent");

    content.innerHTML = `
        <div class="member-form-header"><button class="member-back-button" onclick="renderEventDetail('${escapeHTML(event.id)}')">← Kembali ke Detail</button><h3>Edit Kegiatan</h3><p>Ubah informasi kegiatan MID.</p></div>
        <form id="editEventForm" class="member-form">
            <div class="member-form-section"><h4>A. Informasi Kegiatan</h4><div class="member-form-grid">
                <div class="member-form-field full"><label>Nama Kegiatan *</label><input type="text" name="title" value="${escapeHTML(event.title)}" required></div>
                <div class="member-form-field"><label>Kategori *</label><select name="category" required>${eventCategories.map(c => `<option value="${escapeHTML(c)}" ${event.category === c ? "selected" : ""}>${escapeHTML(c)}</option>`).join("")}</select></div>
                <div class="member-form-field full"><label>Deskripsi *</label><textarea name="description" rows="4" required>${escapeHTML(event.description || "")}</textarea></div>
            </div></div>
            <div class="member-form-section"><h4>Poster / Flyer Kegiatan</h4><div class="member-form-grid">
                <div class="member-form-field full"><label>Ganti Poster (Opsional)</label><input type="file" id="editEventPoster" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG, atau WEBP. Maksimal 2 MB.</small></div>
                <div class="member-form-field full"><label>Pratinjau Poster</label><div id="editPosterPreview" style="width:100%;min-height:240px;background:linear-gradient(135deg,#211B63,#5141A5,#F4BD50);display:flex;align-items:center;justify-content:center;overflow:hidden"><img id="editPosterImage" alt="Poster kegiatan" style="display:none;max-width:100%;max-height:420px;width:auto;height:auto;object-fit:contain"></div>
                    <label style="margin-top:12px;display:block"><input type="checkbox" id="removeEventPoster"> Hapus poster kegiatan</label></div>
            </div></div>
            <div class="member-form-section"><h4>B. Waktu dan Lokasi</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Tanggal *</label><input type="date" name="date" value="${escapeHTML(event.date || "")}" required></div>
                <div class="member-form-field"><label>Waktu Mulai *</label><input type="time" name="startTime" value="${escapeHTML(event.startTime || "")}" required></div>
                <div class="member-form-field"><label>Waktu Selesai *</label><input type="time" name="endTime" value="${escapeHTML(event.endTime || "")}" required></div>
                <div class="member-form-field full"><label>Lokasi *</label><input type="text" name="location" value="${escapeHTML(event.location || "")}" required></div>
            </div></div>
            <div class="member-form-section"><h4>C. Pengaturan Pendaftaran</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Kuota Peserta *</label><input type="number" name="quota" min="1" step="1" value="${Number(event.quota) || 1}" required></div>
                <div class="member-form-field"><label>Pendaftaran Dibuka *</label><input type="datetime-local" name="registrationStart" value="${escapeHTML(event.registrationStart || "")}" required></div>
                <div class="member-form-field"><label>Pendaftaran Ditutup *</label><input type="datetime-local" name="registrationEnd" value="${escapeHTML(event.registrationEnd || "")}" required></div>
            </div></div>
            <div class="member-form-section"><h4>D. Akses dan Kelayakan Peserta</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Visibilitas *</label><select name="visibility" required>
                    <option value="T1" ${event.visibility === "T1" ? "selected" : ""}>T1 ke atas (Semua Anggota)</option>
                    <option value="T2" ${event.visibility === "T2" ? "selected" : ""}>T2 ke atas</option>
                    <option value="T3" ${event.visibility === "T3" ? "selected" : ""}>T3 saja</option>
                </select><small>Mengatur siapa yang dapat melihat kegiatan.</small></div>
                <div class="member-form-field full"><label>Tingkat yang Boleh Mengikuti *</label>${["T1","T2","T3"].map(level => `<label><input type="checkbox" name="eligibleLevels" value="${level}" ${(event.eligibleLevels || []).includes(level) ? "checked" : ""}> Tingkat ${level}</label>`).join("")}<small>Terpisah dari visibilitas.</small></div>
            </div></div>
            <div class="member-form-section"><h4>E. Kaderisasi dan Status</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Pengaruh Kaderisasi *</label><select name="requirement"><option value="non_required" ${event.requirement === "non_required" ? "selected" : ""}>Tidak Wajib</option><option value="required" ${event.requirement === "required" ? "selected" : ""}>Kegiatan Wajib</option></select></div>
                <div class="member-form-field"><label>Status *</label><select name="status">${["Draft","Dibuka","Berlangsung","Selesai","Dibatalkan"].map(s => `<option value="${s}" ${event.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
            </div></div>
            <div class="member-form-actions"><button type="button" class="member-cancel-button" onclick="renderEventDetail('${escapeHTML(event.id)}')">Batal</button><button type="submit" class="member-save-button">Simpan Perubahan</button></div>
        </form>`;

    const image = document.getElementById("editPosterImage");
    const preview = document.getElementById("editPosterPreview");
    const input = document.getElementById("editEventPoster");
    const remove = document.getElementById("removeEventPoster");
    let selectedPoster = null;

    async function showExistingPoster() {
        if (!event.posterKey) return;
        try {
            const blob = await getEventPoster(event.posterKey);
            if (blob) {
                const url = URL.createObjectURL(blob);
                eventPosterObjectURLs.push(url);
                image.src = url; image.style.display = "block"; preview.style.background = "transparent";
            }
        } catch (error) { console.error("Gagal memuat poster:", error); }
    }
    await showExistingPoster();

    input.addEventListener("change", function() {
        const file = this.files[0];
        if (!file) { selectedPoster = null; return; }
        if (file.size > 2 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(file.type)) {
            alert("Gunakan JPG, PNG, atau WEBP maksimal 2 MB."); this.value = ""; selectedPoster = null; return;
        }
        selectedPoster = file; remove.checked = false;
        const reader = new FileReader();
        reader.onload = e => { image.src = e.target.result; image.style.display = "block"; preview.style.background = "transparent"; };
        reader.readAsDataURL(file);
    });
    remove.addEventListener("change", () => {
        if (remove.checked) { selectedPoster = null; input.value = ""; image.style.display = "none"; preview.style.background = "linear-gradient(135deg,#211B63,#5141A5,#F4BD50)"; }
        else showExistingPoster();
    });

    document.getElementById("editEventForm").addEventListener("submit", async function(e) {
        e.preventDefault();
        const form = this;
        const button = form.querySelector('button[type="submit"]');
        const validationError = validateEventForm(form);
        if (validationError) { alert(validationError); return; }
        button.disabled = true; button.textContent = "Menyimpan...";
        let newPosterKey = null;
        try {
            const data = new FormData(form);
            if (selectedPoster) {
                newPosterKey = "POSTER-EVT-" + Date.now();
                await saveEventPoster(selectedPoster, newPosterKey);
            }
            const updated = {
                ...event, title: data.get("title").trim(), category: data.get("category"),
                description: data.get("description").trim(), date: data.get("date"),
                startTime: data.get("startTime"), endTime: data.get("endTime"),
                location: data.get("location").trim(), quota: Number(data.get("quota")),
                registrationStart: data.get("registrationStart"), registrationEnd: data.get("registrationEnd"),
                visibility: data.get("visibility"),
                eligibleLevels: Array.from(form.querySelectorAll('input[name="eligibleLevels"]:checked')).map(item => item.value),
                requirement: data.get("requirement"), status: data.get("status"),
                posterKey: remove.checked ? null : (newPosterKey || event.posterKey),
                updatedAt: new Date().toISOString()
            };
            await saveEventToFirestore(updated);
            const index = events.findIndex(item => String(item.id) === String(eventId));
            if (index >= 0) events[index] = updated;
            if (event.posterKey && updated.posterKey !== event.posterKey) {
                try { await deleteEventPoster(event.posterKey); } catch (err) { console.warn("Poster lama gagal dibersihkan:", err); }
            }
            alert("Perubahan kegiatan berhasil disimpan!");
            renderEventDetail(event.id);
        } catch (error) {
            console.error("Gagal mengedit kegiatan:", error);
            if (newPosterKey) { try { await deleteEventPoster(newPosterKey); } catch (e2) { console.error(e2); } }
            button.disabled = false; button.textContent = "Simpan Perubahan";
            alert("Perubahan gagal disimpan. Periksa koneksi dan aturan Firestore.");
        }
    });
}

// ===================================
// KEGIATAN — DETAIL DAN HAPUS
// ===================================

async function renderEventDetail(eventId) {
    const event = getEventById(eventId);
    if (!event) { alert("Data kegiatan tidak ditemukan."); renderEvents(); return; }

    let posterHTML = `<div style="width:100%;min-height:260px;background:linear-gradient(135deg,#211B63,#5141A5,#F4BD50)"></div>`;
    if (event.posterKey) {
        try {
            const poster = await getEventPoster(event.posterKey);
            if (poster) {
                const url = URL.createObjectURL(poster);
                eventPosterObjectURLs.push(url);
                posterHTML = `<img src="${url}" alt="Poster ${escapeHTML(event.title)}" style="display:block;width:auto;height:auto;max-width:100%;max-height:650px;object-fit:contain;margin:0 auto">`;
            }
        } catch (error) { console.error("Gagal memuat poster:", error); }
    }

    const levels = (event.eligibleLevels || []).map(level => `Tingkat ${level}`).join(", ") || "-";
    document.getElementById("pageContent").innerHTML = `
        <div class="member-form-header"><button class="member-back-button" onclick="renderEvents()">← Kembali ke Daftar Kegiatan</button><h3>Detail Kegiatan</h3><p>Informasi lengkap kegiatan MID.</p></div>
        <div style="width:100%;margin-bottom:28px">${posterHTML}</div>
        <div class="member-form-section"><h4>${escapeHTML(event.title)}</h4><p>${escapeHTML(event.description || "-")}</p></div>
        <div class="member-form-section"><h4>Informasi Kegiatan</h4>
            <p><strong>Kategori:</strong> ${escapeHTML(event.category || "-")}</p>
            <p><strong>Tanggal:</strong> ${formatDate(event.date)}</p>
            <p><strong>Waktu:</strong> ${escapeHTML(event.startTime || "-")} - ${escapeHTML(event.endTime || "-")}</p>
            <p><strong>Lokasi:</strong> ${escapeHTML(event.location || "-")}</p>
            <p><strong>Status kegiatan:</strong> ${escapeHTML(event.status || "-")}</p></div>
        <div class="member-form-section"><h4>Pengaturan Pendaftaran</h4>
            <p><strong>Kuota peserta:</strong> ${Number(event.quota) || 0} orang</p>
            <p><strong>Pendaftaran dibuka:</strong> ${escapeHTML(event.registrationStart || "-")}</p>
            <p><strong>Pendaftaran ditutup:</strong> ${escapeHTML(event.registrationEnd || "-")}</p>
            <p><strong>Status pendaftaran:</strong> ${escapeHTML(getEventRegistrationState(event))}</p></div>
        <div class="member-form-section"><h4>Akses dan Kelayakan Peserta</h4>
            <p><strong>Visibilitas:</strong> ${escapeHTML(getEventVisibilityLabel(event.visibility))}</p>
            <p><strong>Tingkat yang boleh mengikuti:</strong> ${escapeHTML(levels)}</p></div>
        <div class="member-form-section"><h4>Pengaturan Kaderisasi</h4><p><strong>Kewajiban:</strong> ${event.requirement === "required" ? "Kegiatan Wajib" : "Tidak Wajib"}</p></div>
        <div class="member-form-actions">
            <button type="button" class="member-save-button" onclick="renderEditEventForm('${escapeHTML(event.id)}')">Edit Kegiatan</button>
            <button type="button" class="member-detail-button" onclick="deleteEvent('${escapeHTML(event.id)}')" style="background:#b42318;color:white">Hapus Kegiatan</button>
        </div>`;
}

async function deleteEvent(eventId) {
    const event = getEventById(eventId);
    if (!event) { alert("Kegiatan tidak ditemukan."); return; }
    if (!confirm(`Apakah kamu yakin ingin menghapus kegiatan "${event.title}"?\n\nData kegiatan dan poster terkait akan dihapus.`)) return;

    try {
        await deleteEventFromFirestore(eventId);
        events = events.filter(item => String(item.id) !== String(eventId));
        if (event.posterKey) {
            try { await deleteEventPoster(event.posterKey); }
            catch (error) { console.warn("Poster lokal gagal dihapus:", error); }
        }
        alert("Kegiatan berhasil dihapus.");
        renderEvents();
    } catch (error) {
        console.error("Gagal menghapus kegiatan:", error);
        alert("Kegiatan gagal dihapus. Periksa koneksi dan aturan Firestore.");
    }
}

// ===================================
// ANGGOTA — DAFTAR DAN FILTER
// ===================================

function renderMembers() {
    const content = document.getElementById("pageContent");
    content.innerHTML = `
        <div class="member-toolbar"><div><h3>Daftar Anggota MID</h3><p>Kelola dan pantau seluruh anggota organisasi.</p></div>
            <button class="member-add-button" onclick="renderAddMemberForm()">+ Tambah Anggota</button></div>
        <div class="member-filters"><input type="search" id="memberSearch" placeholder="Cari nama atau nomor anggota...">
            <select id="memberLevelFilter"><option value="">Semua Tingkat</option><option value="T1">Tingkat 1</option><option value="T2">Tingkat 2</option><option value="T3">Tingkat 3</option></select></div>
        <div class="member-summary"><span id="memberCount">0 anggota ditemukan</span></div>
        <div class="member-table-wrap"><table class="member-table"><thead><tr><th>Nama Anggota</th><th>Nomor Anggota</th><th>Tingkat</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="memberTableBody"></tbody></table></div>
        <div class="dashboard-note"><strong>Informasi data</strong><p>Data anggota tersimpan di Firebase Cloud Firestore.</p></div>`;
    document.getElementById("memberSearch").addEventListener("input", filterMembers);
    document.getElementById("memberLevelFilter").addEventListener("change", filterMembers);
    filterMembers();
}

function filterMembers() {
    const search = document.getElementById("memberSearch")?.value.toLowerCase() || "";
    const level = document.getElementById("memberLevelFilter")?.value || "";
    const tbody = document.getElementById("memberTableBody");
    const count = document.getElementById("memberCount");
    if (!tbody || !count) return;

    const filtered = members.filter(member =>
        ((member.name || "").toLowerCase().includes(search) ||
        (member.number || "").toLowerCase().includes(search)) &&
        (!level || member.level === level)
    );
    count.textContent = `${filtered.length} anggota ditemukan`;
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="member-empty">Belum ada anggota yang sesuai.</td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map(member => `
        <tr><td><strong>${escapeHTML(member.name)}</strong></td><td>${escapeHTML(member.number)}</td>
        <td><span class="level-badge ${String(member.level).toLowerCase()}">${escapeHTML(member.level)}</span></td>
        <td><span class="status-badge ${member.status === "Aktif" ? "active" : "inactive"}">${escapeHTML(member.status)}</span></td>
        <td><button class="member-detail-button" onclick="showMemberDetail('${escapeHTML(member.id)}')">Detail</button></td></tr>
    `).join("");
}

// ===================================
// ANGGOTA — TAMBAH
// ===================================

function renderAddMemberForm() {
    const number = generateMemberNumber();
    document.getElementById("pageContent").innerHTML = `
        <div class="member-form-header"><button class="member-back-button" onclick="renderMembers()">← Kembali ke Daftar</button><h3>Tambah Anggota Baru</h3><p>Lengkapi informasi identitas dan keanggotaan.</p></div>
        <form id="addMemberForm" class="member-form">
            <div class="member-form-section"><h4>A. Identitas Pribadi</h4><div class="member-form-grid">
                <div class="member-form-field full"><label>Nama Lengkap *</label><input type="text" name="name" required></div>
                <div class="member-form-field"><label>Jenis Kelamin *</label><select name="gender" required><option value="">Pilih jenis kelamin</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
                <div class="member-form-field"><label>Tempat Lahir *</label><input type="text" name="birthPlace" required></div>
                <div class="member-form-field"><label>Tanggal Lahir *</label><input type="date" name="birthDate" required></div>
                <div class="member-form-field full"><label>Alamat Lengkap *</label><textarea name="address" rows="3" required></textarea></div>
            </div></div>
            <div class="member-form-section"><h4>B. Informasi Kontak</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Nomor WhatsApp *</label><input type="tel" name="phone" required></div>
                <div class="member-form-field"><label>Email *</label><input type="email" name="email" required></div>
            </div></div>
            <div class="member-form-section"><h4>C. Data Keanggotaan</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Nomor Anggota</label><input type="text" name="number" value="${number}" readonly><small>Nomor dibuat otomatis oleh sistem.</small></div>
                <div class="member-form-field"><label>Tanggal Bergabung *</label><input type="date" name="joinDate" value="${new Date().toISOString().slice(0,10)}" required></div>
                <div class="member-form-field"><label>Tingkat Keanggotaan *</label><select name="level" required><option value="T1">Tingkat 1 (T1)</option><option value="T2">Tingkat 2 (T2)</option><option value="T3">Tingkat 3 (T3)</option></select></div>
                <div class="member-form-field"><label>Status Keanggotaan *</label><select name="status" required><option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option></select></div>
            </div></div>
            <div class="member-form-actions"><button type="button" class="member-cancel-button" onclick="renderMembers()">Batal</button><button type="submit" class="member-save-button">Simpan Anggota</button></div>
        </form>`;
    document.getElementById("addMemberForm").addEventListener("submit", saveMember);
}

async function saveMember(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const email = data.get("email").trim().toLowerCase();
    if (members.some(member => (member.email || "").toLowerCase() === email)) {
        alert("Email tersebut sudah digunakan oleh anggota lain."); return;
    }

    const newMember = {
        id: "MID-" + Date.now(),
        number: data.get("number"),
        name: data.get("name").trim(),
        gender: data.get("gender"),
        birthPlace: data.get("birthPlace").trim(),
        birthDate: data.get("birthDate"),
        address: data.get("address").trim(),
        phone: data.get("phone").trim(),
        email,
        joinDate: data.get("joinDate"),
        level: data.get("level"),
        status: data.get("status"),
        createdAt: new Date().toISOString()
    };

    button.disabled = true; button.textContent = "Menyimpan...";
    try {
        await saveMemberToFirestore(newMember);
        members.push(newMember);
        alert("Anggota berhasil ditambahkan.");
        renderMembers();
    } catch (error) {
        console.error("Gagal menyimpan anggota:", error);
        button.disabled = false; button.textContent = "Simpan Anggota";
        alert("Anggota gagal disimpan. Periksa koneksi dan aturan Firestore.");
    }
}

// ===================================
// ANGGOTA — DETAIL DAN EDIT
// ===================================

function showMemberDetail(id) {
    const member = getMemberById(id);
    if (!member) { alert("Data anggota tidak ditemukan."); return; }
    document.getElementById("pageContent").innerHTML = `
        <div class="member-detail-header"><button class="member-back-button" onclick="renderMembers()">← Kembali ke Daftar</button>
            <div class="member-profile"><div class="member-avatar">${escapeHTML((member.name || "?").charAt(0).toUpperCase())}</div>
                <div><h2>${escapeHTML(member.name)}</h2><p>${escapeHTML(member.number)}</p><span class="level-badge ${String(member.level).toLowerCase()}">${escapeHTML(member.level)}</span></div></div></div>
        <div class="member-detail-grid">
            <div class="member-detail-card"><span>Nama Lengkap</span><strong>${escapeHTML(member.name)}</strong></div>
            <div class="member-detail-card"><span>Nomor Anggota</span><strong>${escapeHTML(member.number)}</strong></div>
            <div class="member-detail-card"><span>Jenis Kelamin</span><strong>${escapeHTML(member.gender)}</strong></div>
            <div class="member-detail-card"><span>Tempat, Tanggal Lahir</span><strong>${escapeHTML(member.birthPlace)}, ${formatDate(member.birthDate)}</strong></div>
            <div class="member-detail-card"><span>Alamat</span><strong>${escapeHTML(member.address)}</strong></div>
            <div class="member-detail-card"><span>Nomor WhatsApp</span><strong>${escapeHTML(member.phone)}</strong></div>
            <div class="member-detail-card"><span>Email</span><strong>${escapeHTML(member.email)}</strong></div>
            <div class="member-detail-card"><span>Tanggal Bergabung</span><strong>${formatDate(member.joinDate)}</strong></div>
            <div class="member-detail-card"><span>Tingkat Keanggotaan</span><strong>${escapeHTML(member.level)}</strong></div>
            <div class="member-detail-card"><span>Status Keanggotaan</span><strong>${escapeHTML(member.status)}</strong></div>
        </div>
        <div class="member-form-actions"><button class="member-save-button" onclick="renderEditMemberForm('${escapeHTML(member.id)}')">Edit Data Anggota</button></div>
        <div class="dashboard-note"><strong>Riwayat dan perkembangan anggota</strong><p>Riwayat kegiatan, presensi, angket, dan kaderisasi akan dikembangkan pada modul berikutnya.</p></div>`;
}

function renderEditMemberForm(id) {
    const member = getMemberById(id);
    if (!member) { alert("Data anggota tidak ditemukan."); return; }
    document.getElementById("pageContent").innerHTML = `
        <div class="member-form-header"><button class="member-back-button" onclick="showMemberDetail('${escapeHTML(member.id)}')">← Kembali ke Detail</button><h3>Edit Data Anggota</h3><p>Perbarui informasi anggota sesuai data terbaru.</p></div>
        <form id="editMemberForm" class="member-form">
            <div class="member-form-section"><h4>A. Identitas Pribadi</h4><div class="member-form-grid">
                <div class="member-form-field full"><label>Nama Lengkap *</label><input type="text" name="name" value="${escapeHTML(member.name)}" required></div>
                <div class="member-form-field"><label>Jenis Kelamin *</label><select name="gender"><option value="Laki-laki" ${member.gender === "Laki-laki" ? "selected" : ""}>Laki-laki</option><option value="Perempuan" ${member.gender === "Perempuan" ? "selected" : ""}>Perempuan</option></select></div>
                <div class="member-form-field"><label>Tempat Lahir *</label><input type="text" name="birthPlace" value="${escapeHTML(member.birthPlace)}" required></div>
                <div class="member-form-field"><label>Tanggal Lahir *</label><input type="date" name="birthDate" value="${escapeHTML(member.birthDate)}" required></div>
                <div class="member-form-field full"><label>Alamat Lengkap *</label><textarea name="address" rows="3" required>${escapeHTML(member.address)}</textarea></div>
            </div></div>
            <div class="member-form-section"><h4>B. Informasi Kontak</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Nomor WhatsApp *</label><input type="tel" name="phone" value="${escapeHTML(member.phone)}" required></div>
                <div class="member-form-field"><label>Email *</label><input type="email" name="email" value="${escapeHTML(member.email)}" required></div>
            </div></div>
            <div class="member-form-section"><h4>C. Data Keanggotaan</h4><div class="member-form-grid">
                <div class="member-form-field"><label>Nomor Anggota</label><input type="text" value="${escapeHTML(member.number)}" readonly></div>
                <div class="member-form-field"><label>Tanggal Bergabung</label><input type="date" value="${escapeHTML(member.joinDate)}" readonly></div>
                <div class="member-form-field"><label>Tingkat Keanggotaan *</label><select name="level"><option value="T1" ${member.level === "T1" ? "selected" : ""}>Tingkat 1 (T1)</option><option value="T2" ${member.level === "T2" ? "selected" : ""}>Tingkat 2 (T2)</option><option value="T3" ${member.level === "T3" ? "selected" : ""}>Tingkat 3 (T3)</option></select></div>
                <div class="member-form-field"><label>Status Keanggotaan *</label><select name="status"><option value="Aktif" ${member.status === "Aktif" ? "selected" : ""}>Aktif</option><option value="Nonaktif" ${member.status === "Nonaktif" ? "selected" : ""}>Nonaktif</option></select></div>
            </div></div>
            <div class="member-form-actions"><button type="button" class="member-cancel-button" onclick="showMemberDetail('${escapeHTML(member.id)}')">Batal</button><button type="submit" class="member-save-button">Simpan Perubahan</button></div>
        </form>`;
    document.getElementById("editMemberForm").addEventListener("submit", event => updateMember(event, id));
}

async function updateMember(event, id) {
    event.preventDefault();
    const member = getMemberById(id);
    if (!member) { alert("Data anggota tidak ditemukan."); return; }
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const email = data.get("email").trim().toLowerCase();
    if (members.some(item => String(item.id) !== String(id) && (item.email || "").toLowerCase() === email)) {
        alert("Email tersebut sudah digunakan anggota lain."); return;
    }

    const updated = {
        ...member,
        name: data.get("name").trim(), gender: data.get("gender"),
        birthPlace: data.get("birthPlace").trim(), birthDate: data.get("birthDate"),
        address: data.get("address").trim(), phone: data.get("phone").trim(),
        email, level: data.get("level"), status: data.get("status"),
        updatedAt: new Date().toISOString()
    };
    button.disabled = true; button.textContent = "Menyimpan...";
    try {
        await saveMemberToFirestore(updated);
        const index = members.findIndex(item => String(item.id) === String(id));
        members[index] = updated;
        alert("Data anggota berhasil diperbarui.");
        showMemberDetail(id);
    } catch (error) {
        console.error("Gagal memperbarui anggota:", error);
        button.disabled = false; button.textContent = "Simpan Perubahan";
        alert("Data anggota gagal diperbarui. Periksa koneksi dan aturan Firestore.");
    }
}

// ===================================
// NAVIGASI
// ===================================

function openPage(page) {
    if (!pages[page]) return;
    const data = pages[page];
    document.getElementById("pageTitle").textContent = data.title;
    document.getElementById("pageDescription").textContent = data.description;
    const stats = document.getElementById("dashboardStats");
    const content = document.getElementById("pageContent");

    document.querySelectorAll(".menu-item").forEach(item => item.classList.remove("active"));
    const activeItem = document.querySelector(`.menu-item[data-page="${page}"]`);
    if (activeItem) {
        activeItem.classList.add("active");
        document.querySelectorAll(".group-menu").forEach(menu => menu.classList.remove("show"));
        document.querySelectorAll(".group-toggle").forEach(button => {
            button.classList.remove("open");
            button.setAttribute("aria-expanded", "false");
        });
        const parent = activeItem.closest(".group-menu");
        if (parent) {
            parent.classList.add("show");
            const groupButton = document.querySelector(`.group-toggle[data-group="${parent.id.replace("group-", "")}"]`);
            if (groupButton) { groupButton.classList.add("open"); groupButton.setAttribute("aria-expanded", "true"); }
        }
    }

    if (page === "dashboard") {
        stats.style.display = "grid";
        renderAdminDashboard();
    } else {
        stats.style.display = "none";
        document.getElementById("panelTitle").textContent = data.title;
        document.getElementById("panelDescription").textContent = data.description;
        if (page === "anggota") renderMembers();
        else if (page === "kegiatan") renderEvents();
        else content.innerHTML = `<div class="dashboard-note"><strong>${escapeHTML(data.title)}</strong><p>Modul ini akan kita kembangkan pada tahap berikutnya.</p></div>`;
    }
    document.querySelector(".sidebar").classList.remove("show");
}

// ===================================
// FIREBASE AUTHENTICATION
// ===================================

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    loginMessage.textContent = "Memeriksa akun...";
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Tampilan aplikasi dibuka oleh onAuthStateChanged setelah verifikasi admin.
    } catch (error) {
        console.error("Login Firebase gagal:", error);
        loginMessage.textContent = "Email atau kata sandi salah, atau akun belum terdaftar.";
        button.disabled = false;
    }
});

auth.onAuthStateChanged(async function(user) {
    currentUser = user || null;
    firebaseReady = false;

    if (!user) {
        members = [];
        events = [];
        appPage.style.display = "none";
        loginPage.style.display = "flex";
        loginForm.reset();
        loginMessage.textContent = "";
        loginForm.querySelector('button[type="submit"]').disabled = false;
        return;
    }

    loginMessage.textContent = "Memverifikasi administrator...";
    try {
        // Setiap akun administrator harus memiliki dokumen admins/{UID}.
        const adminDoc = await db.collection(ADMINS_COLLECTION).doc(user.uid).get();
        if (!adminDoc.exists || adminDoc.data()?.active === false) {
            await auth.signOut();
            loginMessage.textContent = "Akun ini belum memiliki hak akses administrator MID.";
            return;
        }

        loginMessage.textContent = "Memuat data MID...";
        await Promise.all([loadMembers(), loadEvents()]);
        firebaseReady = true;
        loginPage.style.display = "none";
        appPage.style.display = "block";
        loginMessage.textContent = "";
        loginForm.querySelector('button[type="submit"]').disabled = false;
        openPage("dashboard");
    } catch (error) {
        console.error("Gagal memuat MID:", error);
        loginMessage.textContent = "Gagal mengakses database. Periksa koneksi dan Firestore Rules.";
        try { await auth.signOut(); } catch (signOutError) { console.error(signOutError); }
    }
});

logoutButton.addEventListener("click", async function() {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout gagal:", error);
        alert("Gagal keluar dari akun.");
    }
});

// ===================================
// MENU, GRUP, DAN MOBILE
// ===================================

document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", function(event) {
        event.preventDefault();
        if (!firebaseReady) return;
        openPage(this.dataset.page);
    });
});

document.querySelectorAll(".group-toggle").forEach(button => {
    button.addEventListener("click", function() {
        const menu = document.getElementById("group-" + this.dataset.group);
        if (!menu) return;
        const isOpen = menu.classList.contains("show");
        menu.classList.toggle("show");
        this.classList.toggle("open", !isOpen);
        this.setAttribute("aria-expanded", String(!isOpen));
    });
});

document.getElementById("menuToggle").addEventListener("click", function() {
    document.querySelector(".sidebar").classList.toggle("show");
});

document.getElementById("registerLink").addEventListener("click", function() {
    alert("Pendaftaran akun anggota akan dibangun pada tahap berikutnya. Untuk sementara, akun dibuat oleh administrator melalui Firebase Authentication.");
});

// ===================================
// KONDISI AWAL
// ===================================

loginPage.style.display = "flex";
appPage.style.display = "none";

// Fungsi-fungsi ini dipanggil melalui atribut onclick pada konten dinamis.
Object.assign(window, {
    openPage,
    renderMembers,
    filterMembers,
    renderAddMemberForm,
    saveMember,
    showMemberDetail,
    renderEditMemberForm,
    updateMember,
    renderEvents,
    filterEvents,
    renderAddEventForm,
    renderEditEventForm,
    renderEventDetail,
    deleteEvent,
    canMemberViewEvent,
    canMemberJoinEvent,
    canMemberRegisterEvent,
    getEventRegistrationState
});
