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
const MONITORING_COLLECTIONS = {
    artikel: "content_articles",
    program: "content_programs",
    galeri: "content_gallery"
};
const CONTENT_SCHEMAS = {
    artikel: {
        title: "Artikel", description: "Kelola tulisan, gagasan, dan publikasi MID.", collection: "content_articles",
        fields: [
            {key:"title",label:"Judul Artikel",type:"text"},
            {key:"category",label:"Kategori",type:"select",options:["Dakwah","Keislaman","Pendidikan","Sosial","Organisasi","Opini","Lainnya"]},
            {key:"author",label:"Penulis",type:"text"},
            {key:"excerpt",label:"Ringkasan",type:"textarea"},
            {key:"body",label:"Isi Artikel",type:"textarea"},
            {key:"coverUrl",label:"URL Gambar Sampul",type:"url",optional:true},
            {key:"status",label:"Status Publikasi",type:"select",options:["Draft","Terbit","Arsip"]}
        ], columns:["title","category","author","status","updatedAt"]
    },
    program: {
        title: "Program", description: "Kelola program kerja dan inisiatif organisasi.", collection: "content_programs",
        fields: [
            {key:"title",label:"Nama Program",type:"text"},
            {key:"category",label:"Bidang Program",type:"select",options:["Pendidikan","Keislaman","Sosial","Kepemudaan","Kaderisasi","Media","Lainnya"]},
            {key:"description",label:"Deskripsi",type:"textarea"},
            {key:"target",label:"Sasaran",type:"text",optional:true},
            {key:"startDate",label:"Tanggal Mulai",type:"date",optional:true},
            {key:"endDate",label:"Tanggal Selesai",type:"date",optional:true},
            {key:"status",label:"Status Program",type:"select",options:["Perencanaan","Berjalan","Selesai","Ditunda","Dibatalkan"]}
        ], columns:["title","category","status","startDate","endDate"]
    },
    galeri: {
        title: "Galeri", description: "Kelola dokumentasi dan tautan media kegiatan MID.", collection: "content_gallery",
        fields: [
            {key:"title",label:"Judul Dokumentasi",type:"text"},
            {key:"eventId",label:"Kegiatan Terkait",type:"event",optional:true},
            {key:"mediaUrl",label:"URL Foto/Video",type:"url"},
            {key:"caption",label:"Keterangan",type:"textarea",optional:true},
            {key:"date",label:"Tanggal Dokumentasi",type:"date",optional:true},
            {key:"status",label:"Status",type:"select",options:["Tampil","Draft","Arsip"]}
        ], columns:["title","eventTitle","date","status"]
    }
};
let contentCache = { artikel: [], program: [], galeri: [] };
const MANAGEMENT_COLLECTIONS = {
    pendaftaran: "registrations",
    presensi: "attendances",
    angket: "surveys",
    kaderisasi: "cadre_evaluations",
    susulan: "makeup_activities"
};
let managementCache = {
    pendaftaran: [], presensi: [], angket: [], kaderisasi: [], susulan: []
};

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
// MODUL MANAJEMEN LANJUTAN — FIRESTORE
// ===================================

const managementSchemas = {
    pendaftaran: {
        title: "Pendaftaran Kegiatan",
        description: "Kelola pengajuan peserta dan keputusan administrator.",
        fields: [
            { key: "eventId", label: "Kegiatan", type: "event" },
            { key: "memberId", label: "Anggota", type: "member" },
            { key: "status", label: "Status", type: "select", options: ["Menunggu", "Disetujui", "Ditolak"] },
            { key: "note", label: "Catatan", type: "textarea", optional: true }
        ],
        columns: ["eventTitle", "memberName", "status", "createdAt"],
        labels: { eventTitle: "Kegiatan", memberName: "Anggota", status: "Status", createdAt: "Tanggal" }
    },
    presensi: {
        title: "Presensi Kegiatan",
        description: "Catat kehadiran peserta pada setiap kegiatan.",
        fields: [
            { key: "eventId", label: "Kegiatan", type: "event" },
            { key: "memberId", label: "Anggota", type: "member" },
            { key: "date", label: "Tanggal Presensi", type: "date" },
            { key: "status", label: "Kehadiran", type: "select", options: ["Hadir", "Izin", "Sakit", "Alpa"] },
            { key: "note", label: "Keterangan", type: "textarea", optional: true }
        ],
        columns: ["eventTitle", "memberName", "date", "status"],
        labels: { eventTitle: "Kegiatan", memberName: "Anggota", date: "Tanggal", status: "Kehadiran" }
    },
    angket: {
        title: "Pengelolaan Angket",
        description: "Buat instrumen angket dan pantau status pengumpulan jawaban.",
        fields: [
            { key: "title", label: "Judul Angket", type: "text" },
            { key: "eventId", label: "Kegiatan terkait", type: "event", optional: true },
            { key: "question", label: "Pertanyaan", type: "textarea" },
            { key: "type", label: "Jenis Jawaban", type: "select", options: ["Teks", "Skala 1–5", "Pilihan"] },
            { key: "options", label: "Pilihan jawaban (pisahkan dengan koma)", type: "text", optional: true },
            { key: "status", label: "Status", type: "select", options: ["Draft", "Aktif", "Ditutup"] }
        ],
        columns: ["title", "eventTitle", "type", "status"],
        labels: { title: "Angket", eventTitle: "Kegiatan", type: "Jenis", status: "Status" }
    },
    kaderisasi: {
        title: "Evaluasi Kaderisasi",
        description: "Catat perkembangan, penilaian, dan catatan pembinaan anggota.",
        fields: [
            { key: "memberId", label: "Anggota", type: "member" },
            { key: "date", label: "Tanggal Evaluasi", type: "date" },
            { key: "aspect", label: "Aspek Evaluasi", type: "select", options: ["Keislaman", "Kepemimpinan", "Intelektual", "Komunikasi", "Sosial", "Komitmen", "Lainnya"] },
            { key: "score", label: "Skor (1–5)", type: "number", min: 1, max: 5 },
            { key: "evaluator", label: "Evaluator", type: "text" },
            { key: "notes", label: "Catatan Evaluasi", type: "textarea", optional: true }
        ],
        columns: ["memberName", "date", "aspect", "score", "evaluator"],
        labels: { memberName: "Anggota", date: "Tanggal", aspect: "Aspek", score: "Skor", evaluator: "Evaluator" }
    },
    susulan: {
        title: "Kegiatan Susulan",
        description: "Kelola penugasan atau kegiatan pengganti bagi anggota.",
        fields: [
            { key: "memberId", label: "Anggota", type: "member" },
            { key: "eventId", label: "Kegiatan Asal", type: "event" },
            { key: "activity", label: "Bentuk Kegiatan Susulan", type: "text" },
            { key: "date", label: "Tanggal Pelaksanaan", type: "date" },
            { key: "status", label: "Status", type: "select", options: ["Ditugaskan", "Dalam Proses", "Selesai", "Dibatalkan"] },
            { key: "notes", label: "Catatan", type: "textarea", optional: true }
        ],
        columns: ["memberName", "eventTitle", "activity", "date", "status"],
        labels: { memberName: "Anggota", eventTitle: "Kegiatan Asal", activity: "Kegiatan Susulan", date: "Tanggal", status: "Status" }
    }
};

function managementOptionList(field) {
    if (field.type === "member") return members.map(m => `<option value="${escapeHTML(m.id)}">${escapeHTML(m.name)} — ${escapeHTML(m.number || m.level || "Anggota")}</option>`).join("");
    if (field.type === "event") return events.map(e => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.title)}</option>`).join("");
    return (field.options || []).map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
}

function managementFieldHTML(field) {
    const required = field.optional ? "" : "required";
    let control = "";
    if (field.type === "select" || field.type === "member" || field.type === "event") {
        const empty = field.optional ? `<option value="">— Tidak dipilih —</option>` : `<option value="">Pilih ${escapeHTML(field.label.toLowerCase())}</option>`;
        control = `<select name="${field.key}" ${required}>${empty}${managementOptionList(field)}</select>`;
    } else if (field.type === "textarea") {
        control = `<textarea name="${field.key}" rows="3" ${required}></textarea>`;
    } else {
        const extra = field.min !== undefined ? `min="${field.min}" max="${field.max}"` : "";
        control = `<input type="${field.type}" name="${field.key}" ${extra} ${required} ${field.type === "date" ? `value="${getTodayISO()}"` : ""}>`;
    }
    return `<label class="mid-field"><span>${escapeHTML(field.label)}${field.optional ? " (opsional)" : ""}</span>${control}</label>`;
}

function getTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function resolveManagementNames(module, record) {
    const member = members.find(m => String(m.id) === String(record.memberId));
    const event = events.find(e => String(e.id) === String(record.eventId));
    return { ...record, memberName: member?.name || record.memberName || "Anggota tidak ditemukan", eventTitle: event?.title || record.eventTitle || "—" };
}

async function loadManagementRecords(module) {
    const snapshot = await db.collection(MANAGEMENT_COLLECTIONS[module]).get();
    managementCache[module] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return managementCache[module];
}

async function renderManagementModule(module) {
    const schema = managementSchemas[module];
    if (!schema) return;
    const content = document.getElementById("pageContent");
    content.innerHTML = `<div class="dashboard-note">Memuat ${escapeHTML(schema.title)}...</div>`;
    try {
        await loadManagementRecords(module);
        renderManagementContent(module);
    } catch (error) {
        console.error(`Gagal memuat modul ${module}:`, error);
        content.innerHTML = `<div class="dashboard-note"><strong>Data belum dapat dimuat.</strong><p>Periksa koneksi internet dan Firestore Rules, lalu muat ulang modul ini.</p><button class="secondary-button" onclick="renderManagementModule('${module}')">Coba Lagi</button></div>`;
    }
}

function renderManagementContent(module) {
    const schema = managementSchemas[module];
    const records = (managementCache[module] || []).map(r => resolveManagementNames(module, r));
    const fields = schema.fields.map(managementFieldHTML).join("");
    const headers = schema.columns.map(key => `<th>${escapeHTML(schema.labels[key] || key)}</th>`).join("");
    const rows = records.map(record => `<tr>${schema.columns.map(key => `<td>${escapeHTML(record[key] ?? "—")}</td>`).join("")}<td class="mid-actions"><button class="secondary-button small" onclick="editManagementRecord('${module}','${escapeHTML(record.id)}')">Ubah</button><button class="danger-button small" onclick="deleteManagementRecord('${module}','${escapeHTML(record.id)}')">Hapus</button></td></tr>`).join("");
    document.getElementById("pageContent").innerHTML = `
        <section class="mid-module-intro"><div><h3>${escapeHTML(schema.title)}</h3><p>${escapeHTML(schema.description)}</p></div><span class="mid-count">${records.length} data</span></section>
        <form class="mid-module-form" id="form-${module}" onsubmit="saveManagementRecord(event,'${module}')">
            <input type="hidden" name="recordId" value="">
            <div class="mid-form-grid">${fields}</div>
            <div class="mid-form-actions"><button type="submit" class="primary-button">Simpan Data</button><button type="reset" class="secondary-button" onclick="resetManagementForm('${module}')">Kosongkan</button></div>
            <p class="mid-form-message" id="message-${module}"></p>
        </form>
        <div class="mid-table-wrap"><table class="mid-table"><thead><tr>${headers}<th>Aksi</th></tr></thead><tbody>${rows || `<tr><td colspan="${schema.columns.length+1}" class="mid-empty">Belum ada data.</td></tr>`}</tbody></table></div>`;
}

async function saveManagementRecord(event, module) {
    event.preventDefault();
    const schema = managementSchemas[module];
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const message = document.getElementById(`message-${module}`);
    const data = new FormData(form);
    const id = String(data.get("recordId") || "").trim();
    const record = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    schema.fields.forEach(field => { record[field.key] = String(data.get(field.key) || "").trim(); });
    if (record.eventId) record.eventTitle = events.find(e => String(e.id) === record.eventId)?.title || "";
    if (record.memberId) record.memberName = members.find(m => String(m.id) === record.memberId)?.name || "";
    if (module === "pendaftaran" && !id) record.submittedAt = record.createdAt;
    if (module === "presensi" && !record.date) record.date = getTodayISO();
    if (module === "angket") record.options = record.options ? record.options.split(",").map(x => x.trim()).filter(Boolean) : [];
    if (module === "kaderisasi") record.score = Number(record.score || 0);
    if (id) {
        const old = (managementCache[module] || []).find(x => String(x.id) === id);
        record.createdAt = old?.createdAt || record.createdAt;
    }
    button.disabled = true; button.textContent = "Menyimpan...";
    try {
        const ref = id ? db.collection(MANAGEMENT_COLLECTIONS[module]).doc(id) : db.collection(MANAGEMENT_COLLECTIONS[module]).doc();
        await ref.set(record, { merge: true });
        await loadManagementRecords(module);
        renderManagementContent(module);
    } catch (error) {
        console.error(`Gagal menyimpan ${module}:`, error);
        message.textContent = "Gagal menyimpan. Periksa koneksi dan aturan Firestore.";
        button.disabled = false; button.textContent = "Simpan Data";
    }
}

function editManagementRecord(module, id) {
    const record = (managementCache[module] || []).find(x => String(x.id) === String(id));
    if (!record) return;
    const form = document.getElementById(`form-${module}`);
    if (!form) return;
    form.elements.recordId.value = record.id;
    managementSchemas[module].fields.forEach(field => {
        const control = form.elements[field.key];
        if (!control) return;
        let value = record[field.key] ?? "";
        if (field.key === "options" && Array.isArray(value)) value = value.join(", ");
        control.value = value;
    });
    form.querySelector('button[type="submit"]').textContent = "Perbarui Data";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetManagementForm(module) {
    const form = document.getElementById(`form-${module}`);
    if (!form) return;
    setTimeout(() => {
        form.elements.recordId.value = "";
        const button = form.querySelector('button[type="submit"]');
        if (button) button.textContent = "Simpan Data";
    }, 0);
}

async function deleteManagementRecord(module, id) {
    const record = (managementCache[module] || []).find(x => String(x.id) === String(id));
    if (!record || !confirm("Hapus data ini secara permanen?")) return;
    try {
        await db.collection(MANAGEMENT_COLLECTIONS[module]).doc(String(id)).delete();
        await loadManagementRecords(module);
        renderManagementContent(module);
    } catch (error) {
        console.error(`Gagal menghapus ${module}:`, error);
        alert("Data gagal dihapus. Periksa koneksi dan Firestore Rules.");
    }
}

// ===================================
// MONITORING — LAPORAN ORGANISASI & ANGGOTA
// ===================================
async function readCollection(name) {
    const snap = await db.collection(name).get();
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}
function csvCell(value) {
    const text = String(value ?? "");
    return '"' + text.replace(/"/g, '""') + '"';
}
function downloadCSV(filename, rows) {
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
async function renderOrganizationReport() {
    const el = document.getElementById("pageContent");
    el.innerHTML = '<div class="dashboard-note">Menghimpun data organisasi dari Firestore...</div>';
    try {
        const [regs, attendance, surveys, cadre, makeup] = await Promise.all([
            readCollection("registrations"), readCollection("attendances"),
            readCollection("surveys"), readCollection("cadre_evaluations"), readCollection("makeup_activities")
        ]);
        const active = members.filter(m => String(m.status || "").toLowerCase() === "aktif").length;
        const pending = regs.filter(x => x.status === "Menunggu").length;
        const present = attendance.filter(x => x.status === "Hadir").length;
        const attendanceRate = attendance.length ? Math.round(present / attendance.length * 100) : 0;
        const completedMakeup = makeup.filter(x => x.status === "Selesai").length;
        el.innerHTML = `
          <div class="mid-report-grid">
            <div class="mid-report-card"><span>Total Anggota</span><strong>${members.length}</strong></div>
            <div class="mid-report-card"><span>Anggota Aktif</span><strong>${active}</strong></div>
            <div class="mid-report-card"><span>Total Kegiatan</span><strong>${events.length}</strong></div>
            <div class="mid-report-card"><span>Pendaftaran Menunggu</span><strong>${pending}</strong></div>
            <div class="mid-report-card"><span>Tingkat Kehadiran</span><strong>${attendanceRate}%</strong><small>${present} dari ${attendance.length} catatan presensi</small></div>
            <div class="mid-report-card"><span>Angket Aktif</span><strong>${surveys.filter(x=>x.status==="Aktif").length}</strong></div>
            <div class="mid-report-card"><span>Evaluasi Kaderisasi</span><strong>${cadre.length}</strong></div>
            <div class="mid-report-card"><span>Susulan Selesai</span><strong>${completedMakeup}</strong></div>
          </div>
          <div class="dashboard-section"><div class="section-heading"><div><h3>Ringkasan Data</h3><p>Angka dihitung dari dokumen yang tersedia di Firestore saat halaman dibuka.</p></div></div>
          <div class="mid-table-wrap"><table class="mid-table"><thead><tr><th>Indikator</th><th>Jumlah</th></tr></thead><tbody>
          <tr><td>Anggota berdasarkan level T1</td><td>${members.filter(x=>x.level==="T1").length}</td></tr>
          <tr><td>Anggota berdasarkan level T2</td><td>${members.filter(x=>x.level==="T2").length}</td></tr>
          <tr><td>Anggota berdasarkan level T3</td><td>${members.filter(x=>x.level==="T3").length}</td></tr>
          <tr><td>Total catatan presensi</td><td>${attendance.length}</td></tr>
          <tr><td>Total evaluasi kaderisasi</td><td>${cadre.length}</td></tr>
          <tr><td>Total kegiatan susulan</td><td>${makeup.length}</td></tr>
          </tbody></table></div></div>
          <button class="primary-button" onclick="exportOrganizationReport()">Unduh Ringkasan CSV</button>`;
        window._midReportCache = {regs,attendance,surveys,cadre,makeup};
    } catch (error) {
        console.error("Laporan organisasi gagal dimuat:", error);
        el.innerHTML = '<div class="dashboard-note"><strong>Laporan belum dapat dimuat.</strong><p>Periksa Firestore Rules dan pastikan koleksi modul manajemen sudah dapat dibaca.</p><button class="secondary-button" onclick="renderOrganizationReport()">Coba Lagi</button></div>';
    }
}
function exportOrganizationReport() {
    const c = window._midReportCache || {};
    const rows = [["Indikator","Jumlah"], ["Total anggota",members.length], ["Anggota aktif",members.filter(m=>String(m.status||"").toLowerCase()==="aktif").length], ["Total kegiatan",events.length], ["Pendaftaran menunggu",(c.regs||[]).filter(x=>x.status==="Menunggu").length], ["Catatan presensi",(c.attendance||[]).length], ["Evaluasi kaderisasi",(c.cadre||[]).length], ["Kegiatan susulan",(c.makeup||[]).length]];
    downloadCSV("MID-Laporan-Organisasi.csv", rows);
}
async function renderMemberReport() {
    const el = document.getElementById("pageContent");
    el.innerHTML = '<div class="dashboard-note">Memuat laporan anggota...</div>';
    try {
        const [attendance,cadre,regs] = await Promise.all([readCollection("attendances"),readCollection("cadre_evaluations"),readCollection("registrations")]);
        const rows = members.map(m => {
            const a=attendance.filter(x=>String(x.memberId)===String(m.id));
            const c=cadre.filter(x=>String(x.memberId)===String(m.id));
            const r=regs.filter(x=>String(x.memberId)===String(m.id));
            const hadir=a.filter(x=>x.status==="Hadir").length;
            const avg=c.length?(c.reduce((s,x)=>s+Number(x.score||0),0)/c.length).toFixed(2):"—";
            return {...m,attendance:a.length,present:hadir,rate:a.length?Math.round(hadir/a.length*100)+"%":"—",evaluations:c.length,average:avg,registrations:r.length};
        });
        window._midMemberReportRows=rows;
        el.innerHTML=`<div class="member-toolbar"><div><h3>Laporan Perkembangan Anggota</h3><p>Rekap kehadiran, pendaftaran, dan evaluasi kaderisasi setiap anggota.</p></div><button class="secondary-button" onclick="exportMemberReport()">Unduh CSV</button></div>
        <div class="member-filters"><input id="memberReportSearch" type="search" placeholder="Cari nama atau nomor anggota..." oninput="filterMemberReport()"></div>
        <div class="mid-table-wrap"><table class="mid-table"><thead><tr><th>Nama</th><th>Nomor</th><th>Level</th><th>Kehadiran</th><th>Rasio Hadir</th><th>Evaluasi</th><th>Rata-rata Skor</th><th>Pendaftaran</th></tr></thead><tbody id="memberReportBody">${memberReportRowsHTML(rows)}</tbody></table></div>`;
    } catch(error) { console.error(error); el.innerHTML='<div class="dashboard-note">Laporan anggota gagal dimuat. Periksa koneksi dan Firestore Rules.</div>'; }
}
function memberReportRowsHTML(rows) {
    return rows.map(x=>`<tr><td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.number||"—")}</td><td>${escapeHTML(x.level||"—")}</td><td>${x.present}/${x.attendance}</td><td>${x.rate}</td><td>${x.evaluations}</td><td>${x.average}</td><td>${x.registrations}</td></tr>`).join("") || '<tr><td colspan="8" class="mid-empty">Belum ada data anggota.</td></tr>';
}
function filterMemberReport() {
    const q=(document.getElementById("memberReportSearch")?.value||"").toLowerCase();
    const rows=(window._midMemberReportRows||[]).filter(x=>(x.name+" "+(x.number||"")).toLowerCase().includes(q));
    document.getElementById("memberReportBody").innerHTML=memberReportRowsHTML(rows);
}
function exportMemberReport() {
    const rows=window._midMemberReportRows||[];
    downloadCSV("MID-Laporan-Anggota.csv",[["Nama","Nomor","Level","Status","Hadir","Total Presensi","Rasio Hadir","Jumlah Evaluasi","Rata-rata Skor","Pendaftaran"],...rows.map(x=>[x.name,x.number,x.level,x.status,x.present,x.attendance,x.rate,x.evaluations,x.average,x.registrations])]);
}
async function renderSurveyExport() {
    const el=document.getElementById("pageContent");
    el.innerHTML='<div class="dashboard-note">Memuat data angket...</div>';
    try {
        const [surveys,responses]=await Promise.all([readCollection("surveys"),readCollection("survey_responses")]);
        window._midSurveyExport={surveys,responses};
        el.innerHTML=`<div class="mid-module-intro"><div><h3>Ekspor Hasil Angket</h3><p>Unduh daftar instrumen dan jawaban angket dalam format CSV.</p></div><span class="mid-count">${responses.length} jawaban</span></div>
        <div class="mid-report-grid"><div class="mid-report-card"><span>Total Angket</span><strong>${surveys.length}</strong></div><div class="mid-report-card"><span>Total Jawaban</span><strong>${responses.length}</strong></div></div>
        <div class="mid-form-actions"><button class="primary-button" onclick="exportSurveyDefinitions()">Ekspor Daftar Angket</button><button class="secondary-button" onclick="exportSurveyResponses()">Ekspor Jawaban Angket</button></div>
        <div class="mid-table-wrap"><table class="mid-table"><thead><tr><th>Angket</th><th>Status</th><th>Jumlah Jawaban</th></tr></thead><tbody>${surveys.map(s=>`<tr><td>${escapeHTML(s.title||"Tanpa judul")}</td><td>${escapeHTML(s.status||"—")}</td><td>${responses.filter(r=>String(r.surveyId)===String(s.id)).length}</td></tr>`).join("")||'<tr><td colspan="3" class="mid-empty">Belum ada angket.</td></tr>'}</tbody></table></div>`;
    } catch(error){console.error(error);el.innerHTML='<div class="dashboard-note">Data ekspor angket gagal dimuat. Periksa Firestore Rules.</div>';}
}
function exportSurveyDefinitions(){const s=window._midSurveyExport?.surveys||[];downloadCSV("MID-Daftar-Angket.csv",[["Judul","Pertanyaan","Jenis","Status","Kegiatan"],...s.map(x=>[x.title,x.question,x.type,x.status,x.eventTitle])]);}
function exportSurveyResponses(){const r=window._midSurveyExport?.responses||[];downloadCSV("MID-Jawaban-Angket.csv",[["ID Angket","ID Anggota","Nama Anggota","Jawaban","Waktu"],...r.map(x=>[x.surveyId,x.memberId,x.memberName,typeof x.answer==="object"?JSON.stringify(x.answer):x.answer,x.createdAt])]);}

// ===================================
// KONTEN — ARTIKEL, PROGRAM, GALERI
// ===================================
function contentFieldHTML(field){
    const req=field.optional?"":"required"; let control="";
    if(field.type==="select"||field.type==="event"){
        const opts=field.type==="event"?events.map(e=>`<option value="${escapeHTML(e.id)}">${escapeHTML(e.title)}</option>`).join(""):(field.options||[]).map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
        control=`<select name="${field.key}" ${req}><option value="">Pilih ${escapeHTML(field.label.toLowerCase())}</option>${opts}</select>`;
    } else if(field.type==="textarea") control=`<textarea name="${field.key}" rows="4" ${req}></textarea>`;
    else control=`<input type="${field.type}" name="${field.key}" ${req}>`;
    return `<label class="mid-field"><span>${escapeHTML(field.label)}${field.optional?" (opsional)":""}</span>${control}</label>`;
}
async function loadContent(module){const snap=await db.collection(CONTENT_SCHEMAS[module].collection).orderBy("updatedAt","desc").get().catch(async()=>db.collection(CONTENT_SCHEMAS[module].collection).get());contentCache[module]=snap.docs.map(d=>({...d.data(),id:d.id}));}
async function renderContentModule(module){const schema=CONTENT_SCHEMAS[module];if(!schema)return;const el=document.getElementById("pageContent");el.innerHTML='<div class="dashboard-note">Memuat konten...</div>';
    try{await loadContent(module);renderContentModuleBody(module);}catch(e){console.error(e);el.innerHTML='<div class="dashboard-note">Konten gagal dimuat. Periksa koneksi dan Firestore Rules.</div>';}}
function renderContentModuleBody(module){const s=CONTENT_SCHEMAS[module],rows=contentCache[module]||[];
    const headers=s.columns.map(k=>`<th>${escapeHTML(({title:"Judul",category:"Kategori",author:"Penulis",status:"Status",updatedAt:"Diperbarui",eventTitle:"Kegiatan",date:"Tanggal",startDate:"Mulai",endDate:"Selesai"})[k]||k)}</th>`).join("");
    const body=rows.map(r=>`<tr>${s.columns.map(k=>`<td>${escapeHTML(r[k]||"—")}</td>`).join("")}<td class="mid-actions"><button class="secondary-button small" onclick="editContentRecord('${module}','${escapeHTML(r.id)}')">Ubah</button><button class="danger-button small" onclick="deleteContentRecord('${module}','${escapeHTML(r.id)}')">Hapus</button></td></tr>`).join("");
    document.getElementById("pageContent").innerHTML=`<div class="mid-module-intro"><div><h3>${s.title}</h3><p>${s.description}</p></div><span class="mid-count">${rows.length} data</span></div>
    <form id="contentForm-${module}" class="mid-module-form" onsubmit="saveContentRecord(event,'${module}')"><input type="hidden" name="recordId"><div class="mid-form-grid">${s.fields.map(contentFieldHTML).join("")}</div><div class="mid-form-actions"><button type="submit" class="primary-button">Simpan Konten</button><button type="reset" class="secondary-button" onclick="resetContentForm('${module}')">Kosongkan</button></div><p class="mid-form-message" id="contentMessage-${module}"></p></form>
    <div class="mid-table-wrap"><table class="mid-table"><thead><tr>${headers}<th>Aksi</th></tr></thead><tbody>${body||`<tr><td colspan="${s.columns.length+1}" class="mid-empty">Belum ada konten.</td></tr>`}</tbody></table></div>`;
}
async function saveContentRecord(event,module){event.preventDefault();const form=event.target,s=CONTENT_SCHEMAS[module],fd=new FormData(form),id=String(fd.get("recordId")||"");const record={createdAt:(contentCache[module]||[]).find(x=>x.id===id)?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};s.fields.forEach(f=>record[f.key]=String(fd.get(f.key)||"").trim());if(record.eventId)record.eventTitle=events.find(e=>String(e.id)===record.eventId)?.title||"";
    const btn=form.querySelector('[type="submit"]');btn.disabled=true;try{const ref=id?db.collection(s.collection).doc(id):db.collection(s.collection).doc();await ref.set(record,{merge:true});await loadContent(module);renderContentModuleBody(module);}catch(e){console.error(e);document.getElementById(`contentMessage-${module}`).textContent="Gagal menyimpan. Periksa koneksi dan Firestore Rules.";btn.disabled=false;}}
function editContentRecord(module,id){const r=(contentCache[module]||[]).find(x=>x.id===id),form=document.getElementById(`contentForm-${module}`);if(!r||!form)return;form.elements.recordId.value=id;CONTENT_SCHEMAS[module].fields.forEach(f=>{if(form.elements[f.key])form.elements[f.key].value=r[f.key]||"";});form.querySelector('[type="submit"]').textContent="Perbarui Konten";form.scrollIntoView({behavior:"smooth",block:"start"});}
function resetContentForm(module){setTimeout(()=>{const f=document.getElementById(`contentForm-${module}`);if(f){f.elements.recordId.value="";f.querySelector('[type="submit"]').textContent="Simpan Konten";}},0);}
async function deleteContentRecord(module,id){if(!confirm("Hapus konten ini secara permanen?"))return;try{await db.collection(CONTENT_SCHEMAS[module].collection).doc(id).delete();await loadContent(module);renderContentModuleBody(module);}catch(e){console.error(e);alert("Konten gagal dihapus. Periksa Firestore Rules.");}}

// ===================================
// PENGATURAN SISTEM & ADMINISTRATOR
// ===================================
async function renderSystemSettings(){const el=document.getElementById("pageContent");el.innerHTML='<div class="dashboard-note">Memuat pengaturan sistem...</div>';
    try{const snap=await db.collection("system_settings").doc("general").get();const s=snap.exists?snap.data():{};
    el.innerHTML=`<div class="mid-module-intro"><div><h3>Pengaturan Umum MID</h3><p>Identitas dan informasi dasar aplikasi.</p></div></div><form id="systemSettingsForm" class="mid-module-form" onsubmit="saveSystemSettings(event)"><div class="mid-form-grid">
    <label class="mid-field"><span>Nama Organisasi</span><input name="organizationName" required value="${escapeHTML(s.organizationName||"Manajemen Informasi Dakwah")}"></label>
    <label class="mid-field"><span>Slogan</span><input name="tagline" value="${escapeHTML(s.tagline||"Membangun Gagasan, Menggerakkan Perubahan.")}"></label>
    <label class="mid-field"><span>Email Kontak</span><input type="email" name="contactEmail" value="${escapeHTML(s.contactEmail||"")}"></label>
    <label class="mid-field"><span>Nomor Kontak</span><input name="contactPhone" value="${escapeHTML(s.contactPhone||"")}"></label>
    <label class="mid-field"><span>Alamat Sekretariat</span><textarea name="address" rows="3">${escapeHTML(s.address||"")}</textarea></label>
    <label class="mid-field"><span>Tentang MID</span><textarea name="about" rows="3">${escapeHTML(s.about||"")}</textarea></label>
    </div><div class="mid-form-actions"><button class="primary-button" type="submit">Simpan Pengaturan</button></div><p id="systemSettingsMessage" class="mid-form-message"></p></form>
    <div class="dashboard-note"><strong>Informasi teknis</strong><p>Pengaturan ini menyimpan identitas organisasi. Pengaturan autentikasi dan kredensial tetap dikelola melalui Firebase Console.</p></div>`;
    }catch(e){console.error(e);el.innerHTML='<div class="dashboard-note">Pengaturan gagal dimuat. Periksa Firestore Rules.</div>';}}
async function saveSystemSettings(event){event.preventDefault();const f=event.target,fd=new FormData(f),data={};["organizationName","tagline","contactEmail","contactPhone","address","about"].forEach(k=>data[k]=String(fd.get(k)||"").trim());data.updatedAt=new Date().toISOString();data.updatedBy=currentUser?.uid||"";const b=f.querySelector('[type="submit"]');b.disabled=true;try{await db.collection("system_settings").doc("general").set(data,{merge:true});document.getElementById("systemSettingsMessage").textContent="Pengaturan berhasil disimpan.";}catch(e){console.error(e);document.getElementById("systemSettingsMessage").textContent="Gagal menyimpan pengaturan. Periksa Firestore Rules.";b.disabled=false;}}
async function renderAdminSettings(){const el=document.getElementById("pageContent");el.innerHTML='<div class="dashboard-note">Memuat daftar administrator...</div>';
    try{const snap=await db.collection(ADMINS_COLLECTION).get();const rows=snap.docs.map(d=>({uid:d.id,...d.data()}));
    el.innerHTML=`<div class="mid-module-intro"><div><h3>Administrator MID</h3><p>Kelola daftar UID yang diizinkan mengakses panel administrator.</p></div><span class="mid-count">${rows.length} akun</span></div>
    <form class="mid-module-form" onsubmit="saveAdminAccess(event)"><div class="mid-form-grid"><label class="mid-field"><span>Firebase Authentication UID</span><input name="uid" required placeholder="Tempel UID akun Firebase"></label><label class="mid-field"><span>Status Akses</span><select name="active"><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label></div><div class="mid-form-actions"><button class="primary-button" type="submit">Simpan Akses Admin</button></div><p id="adminSettingsMessage" class="mid-form-message"></p></form>
    <div class="mid-table-wrap"><table class="mid-table"><thead><tr><th>UID</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHTML(r.uid)}</td><td>${r.active===true?"Aktif":"Nonaktif"}</td><td class="mid-actions"><button class="secondary-button small" onclick="toggleAdminAccess('${escapeHTML(r.uid)}',${r.active===true?"false":"true"})">${r.active===true?"Nonaktifkan":"Aktifkan"}</button></td></tr>`).join("")||'<tr><td colspan="3" class="mid-empty">Belum ada data administrator.</td></tr>'}</tbody></table></div>
    <div class="dashboard-note"><strong>Catatan keamanan</strong><p>Penambahan UID di sini tidak membuat akun Firebase Authentication. Buat akun terlebih dahulu di Firebase Console → Authentication → Users, lalu salin UID-nya. Jangan bagikan kata sandi.</p></div>`;
    }catch(e){console.error(e);el.innerHTML='<div class="dashboard-note">Daftar administrator gagal dimuat. Perbarui Firestore Rules sesuai paket ini.</div>';}}
async function saveAdminAccess(event){event.preventDefault();const fd=new FormData(event.target),uid=String(fd.get("uid")||"").trim(),active=fd.get("active")==="true";if(!uid)return;try{await db.collection(ADMINS_COLLECTION).doc(uid).set({active,updatedAt:new Date().toISOString()},{merge:true});await renderAdminSettings();}catch(e){console.error(e);document.getElementById("adminSettingsMessage").textContent="Gagal menyimpan akses. Periksa Firestore Rules.";}}
async function toggleAdminAccess(uid,active){if(uid===currentUser?.uid&&active===false){alert("Kamu tidak dapat menonaktifkan akses akun yang sedang digunakan.");return;}if(!confirm(`${active?"Aktifkan":"Nonaktifkan"} akses administrator ini?`))return;try{await db.collection(ADMINS_COLLECTION).doc(uid).set({active,updatedAt:new Date().toISOString()},{merge:true});await renderAdminSettings();}catch(e){console.error(e);alert("Perubahan akses gagal. Periksa Firestore Rules.");}}

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
        else if (MANAGEMENT_COLLECTIONS[page]) renderManagementModule(page);
        else if (page === "laporan-organisasi") renderOrganizationReport();
        else if (page === "laporan-anggota") renderMemberReport();
        else if (page === "ekspor-angket") renderSurveyExport();
        else if (CONTENT_SCHEMAS[page]) renderContentModule(page);
        else if (page === "sistem") renderSystemSettings();
        else if (page === "admin") renderAdminSettings();
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
        if (!adminDoc.exists || adminDoc.data()?.active !== true) {
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
    getEventRegistrationState,
    renderManagementModule,
    saveManagementRecord,
    editManagementRecord,
    deleteManagementRecord,
    resetManagementForm,
    renderOrganizationReport, exportOrganizationReport,
    renderMemberReport, filterMemberReport, exportMemberReport,
    renderSurveyExport, exportSurveyDefinitions, exportSurveyResponses,
    renderContentModule, saveContentRecord, editContentRecord, deleteContentRecord, resetContentForm,
    renderSystemSettings, saveSystemSettings, renderAdminSettings, saveAdminAccess, toggleAdminAccess
});

// ===================================
// STYLE TAMBAHAN MODUL MANAJEMEN
// Tidak menghapus tema utama dari style.css.
// ===================================
(function injectManagementStyles() {
    if (document.getElementById("mid-management-styles")) return;
    const style = document.createElement("style");
    style.id = "mid-management-styles";
    style.textContent = `
      .mid-module-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:8px 0 20px}
      .mid-module-intro h3{margin:0 0 6px;color:var(--ink,#211b63)}
      .mid-module-intro p{margin:0;color:var(--muted,#687080);line-height:1.5}
      .mid-count{white-space:nowrap;border-radius:999px;background:#eeedfa;color:#312b79;padding:7px 12px;font-size:12px;font-weight:700}
      .mid-module-form{background:#f8f9fc;border:1px solid #e6e8f0;border-radius:14px;padding:18px;margin-bottom:22px}
      .mid-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .mid-field{display:flex;flex-direction:column;gap:7px;color:#34364a;font-size:13px;font-weight:600}
      .mid-field input,.mid-field select,.mid-field textarea{width:100%;box-sizing:border-box;border:1px solid #d9dce7;border-radius:9px;background:#fff;padding:11px 12px;font:inherit;font-weight:400;color:#25263a;outline:none}
      .mid-field input:focus,.mid-field select:focus,.mid-field textarea:focus{border-color:#6258b5;box-shadow:0 0 0 3px rgba(98,88,181,.12)}
      .mid-field textarea{resize:vertical;min-height:82px}
      .mid-form-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}
      .mid-form-message{font-size:13px;color:#a33;margin:8px 0 0}
      .mid-table-wrap{width:100%;overflow-x:auto;border:1px solid #e8e9ef;border-radius:12px}
      .mid-table{width:100%;border-collapse:collapse;min-width:640px;background:#fff}
      .mid-table th,.mid-table td{padding:12px 13px;text-align:left;border-bottom:1px solid #ececf1;font-size:13px;vertical-align:middle}
      .mid-table th{background:#f6f6fa;color:#42445b;font-weight:700;white-space:nowrap}
      .mid-table tr:last-child td{border-bottom:0}
      .mid-empty{text-align:center!important;color:#7b7d8c;padding:26px!important}
      .mid-actions{display:flex;gap:6px;white-space:nowrap}
      .mid-actions button,.mid-form-actions button{cursor:pointer;border:0;border-radius:8px;padding:9px 12px;font-weight:600}
      .mid-actions .small{font-size:12px;padding:7px 9px}
      .mid-actions .secondary-button,.mid-form-actions .secondary-button{background:#e9eaf1;color:#34364a}
      .mid-actions .danger-button{background:#fff0f0;color:#a52b36}
      .mid-form-actions .primary-button{background:#29236f;color:#fff}
      .mid-form-actions button:disabled{opacity:.6;cursor:wait}
      @media(max-width:650px){.mid-form-grid{grid-template-columns:1fr}.mid-module-intro{flex-direction:column}.mid-module-form{padding:13px}.mid-table th,.mid-table td{padding:10px}}
    `;
    document.head.appendChild(style);
})();


// ===================================
// STYLE TAMBAHAN MONITORING, KONTEN, PENGATURAN
// ===================================
(function injectExtendedStyles(){
 if(document.getElementById("mid-extended-styles"))return;
 const style=document.createElement("style");style.id="mid-extended-styles";
 style.textContent=`
 .mid-report-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin:12px 0 24px}
 .mid-report-card{background:#f7f7fb;border:1px solid #e7e7f0;border-radius:13px;padding:16px;display:flex;flex-direction:column;gap:7px;min-height:88px}
 .mid-report-card span{font-size:12px;color:#666981;font-weight:600}.mid-report-card strong{font-size:27px;color:#29236f;line-height:1.15}.mid-report-card small{font-size:11px;color:#77798a}
 .mid-extended-styles .mid-table{min-width:700px}
 @media(max-width:650px){.mid-report-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mid-report-card{padding:12px}.mid-report-card strong{font-size:23px}}
 `;document.head.appendChild(style);
})();
