/* ============================================================
   Dashboard Provisioning STO JTN — app.js
   INDIBIZ + TSEL Tab Switcher
   ============================================================ */

/* ── Konfigurasi URL ── */
// INDIBIZ: CSV publish dari sheet "INDIBIZ"
const IB_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTNMvUECIc8TJbeMynfITc5c03iYqp5I1lyqKZ27H7n82I6Z8RfPCSs1Axz-hGP1I0YfR6yjOYYO0U/pub?gid=1218838046&single=true&output=csv';

// TSEL: CSV publish dari sheet "DATA RE JTN"
// Spreadsheet ID: 1OrlF3MSls5P9IPRcx3yHgFgWRVlAQPMzkgDSlvlMpEk
// 
// CARA DAPAT GID SHEET "DATA RE JTN":
// 1. Buka spreadsheet tersebut
// 2. Klik tab sheet "DATA RE JTN"
// 3. Lihat URL browser: ...spreadsheets/d/ID/edit#gid=ANGKA
// 4. Angka setelah #gid= itulah yang diisi di bawah
// 5. Pastikan sheet sudah dipublish: File > Share > Publish to web > pilih sheet > CSV > Publish
//
// Sementara menggunakan gid=0 (sheet pertama). Ganti sesuai gid sheet "DATA RE JTN"
const TSEL_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1n1wEMS9qPOCP6XDFDBbe03y5lNI5D-9Aq8fSYJtpTLLjX3nQFL4EL6ZXkIlhRLcshjpA11AeFKS8/pub?gid=0&single=true&output=csv';

// Sheet "TEKNISI HARI INI" — untuk card jumlah teknisi hadir
// Ganti gid=1 dengan gid yang benar untuk sheet "TEKNISI HARI INI"
const TSEL_TEKNISI_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1n1wEMS9qPOCP6XDFDBbe03y5lNI5D-9Aq8fSYJtpTLLjX3nQFL4EL6ZXkIlhRLcshjpA11AeFKS8/pub?gid=82778435&single=true&output=csv';

// Apps Script Web App URL untuk update data TSEL ke Google Sheets
// Bang Kelly perlu mengganti ini dengan URL Apps Script yang sudah di-deploy
const TSEL_APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

/* ── Konstanta ── */
const IB_TARGET = 83;
const MONTHS_ORDER = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
const STATUS_COLORS = ['#0F6E56','#EF9F27','#E24B4A','#378ADD','#D4537E','#888780'];

// Dropdown options TSEL
const TSEL_STATUS_BIMA_OPTIONS = ['COMPWORK','CANCLWORK','WAPPR','WORKFAIL','STARTWORK'];
const TSEL_PROGRESS_OPTIONS = ['Belum Dispatch','Kendala Non Teknik','Aktif di pelanggan','Kendala Teknik','Manja H+','Cek Lokasi'];
const TSEL_TEKNISI_OPTIONS = [
  'JTN | Regu 1','JTN | Regu 2','JTN | Regu 3','JTN | Regu 4','JTN | Regu 5',
  'JTN | Regu 6','JTN | Regu 7','JTN | Regu 8','JTN | Regu 9','JTN | Regu 10',
  'JTN | Regu 11','JTN | Regu 12','JTN | Regu 13','JTN | Regu 14','JTN | Regu 15'
];
const TSEL_QC2_OPTIONS = ['OK','BELUM','PENDING'];

/* ── State ── */
let currentTab = 'indibiz';
let ibAllData = [];
let ibCharts = {};
let tselAllData = [];
let tselFilteredData = []; // data setelah filter
let tselTeknisiHadir = 0; // jumlah teknisi dari sheet TEKNISI HARI INI
let tselCharts = {};

/* ============================================================
   TAB SWITCHING
============================================================ */
function switchTab(tab) {
  currentTab = tab;
  // Update button styles
  document.getElementById('btn-indibiz').classList.toggle('active', tab === 'indibiz');
  document.getElementById('btn-tsel').classList.toggle('active', tab === 'tsel');
  // Show/hide panels
  document.getElementById('panel-indibiz').classList.toggle('active', tab === 'indibiz');
  document.getElementById('panel-tsel').classList.toggle('active', tab === 'tsel');
  // Load data jika belum ada
  if (tab === 'tsel' && tselAllData.length === 0) {
    loadTselData();
  }
}

function loadCurrentTab() {
  if (currentTab === 'indibiz') {
    ibLoadData();
  } else {
    loadTselData();
  }
}

/* ============================================================
   UTILITY
============================================================ */
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const obj = {};
    header.forEach((h, j) => { obj[h] = (cols[j] || '').replace(/^"|"$/g, '').trim(); });
    rows.push(obj);
  }
  return { header, rows };
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

function getTodayString() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

function getTodayYMD() {
  // Returns YYYY-MM-DD for comparison with Tanggal Setting TSEL (format mungkin berbeda)
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getCurrentMonth() {
  const now = new Date();
  return now.getMonth() + 1; // 1-12
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function scrollTable(id, amount) {
  const el = document.getElementById(id);
  if (el) el.scrollBy({ left: amount, behavior: 'smooth' });
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ============================================================
   ======================== INDIBIZ ==========================
============================================================ */

/* ── Status normalizer INDIBIZ ── */
function ibNormalizeStatus(s) {
  const u = (s || '').toUpperCase().trim();
  if (u === 'COMPLETE') return 'Complete';
  if (u.includes('REVOKE')) return 'Revoke Complete';
  if (u.includes('OSS')) return 'OSS Cancel Complete';
  if (u.includes('CANCEL BY SYSTEM')) return 'Cancel by System';
  if (u.includes('CANCEL BY FCC')) return 'Cancel by FCC';
  if (u.includes('CANCEL')) return 'Cancel';
  return s || 'Lainnya';
}

function ibStatusBadge(s) {
  const n = ibNormalizeStatus(s);
  if (n === 'Complete') return `<span class="badge badge-complete">Complete</span>`;
  if (n === 'Revoke Complete') return `<span class="badge badge-revoke">Revoke</span>`;
  if (n === 'OSS Cancel Complete') return `<span class="badge badge-oss">OSS Cancel</span>`;
  if (n.includes('Cancel')) return `<span class="badge badge-cancel">${n}</span>`;
  return `<span class="badge badge-other">${n}</span>`;
}

function ibGetYear(tgl) {
  if (!tgl) return '';
  const parts = tgl.trim().split('/');
  if (parts.length === 3) return parts[2];
  return '';
}

/* ── INDIBIZ Filters ── */
function ibGetFiltered() {
  const year  = document.getElementById('ib-filter-year').value;
  const month = document.getElementById('ib-filter-month').value;
  const date  = document.getElementById('ib-filter-date').value;
  const tech  = document.getElementById('ib-filter-tech').value;
  const search = (document.getElementById('ib-search-input').value || '').toLowerCase();
  return ibAllData.filter(r => {
    if (year  && ibGetYear(r['TGL']) !== year) return false;
    if (month && r['BULAN'] !== month) return false;
    if (date  && (r['TGL'] || '').trim() !== date) return false;
    if (tech  && r['TEKNISI'] !== tech) return false;
    if (search) {
      const hay = [r['NO ORDER'], r['STATUS'], r['PAKET'], r['BULAN'], r['TEKNISI'], r['UPDATE'], r['DETAIL KETERANGAN']].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function ibApplyFilter() {
  const data = ibGetFiltered();
  ibRenderKPI(data);
  ibRenderCharts(data);
  ibRenderTable();
  ibRenderToday();
}

function ibUpdateFilters() {
  const year  = document.getElementById('ib-filter-year').value;
  const month = document.getElementById('ib-filter-month').value;

  const filtered = ibAllData.filter(r => {
    if (year  && ibGetYear(r['TGL']) !== year) return false;
    if (month && r['BULAN'] !== month) return false;
    return true;
  });

  const months = [...new Set(ibAllData.filter(r => !year || ibGetYear(r['TGL']) === year).map(r => r['BULAN']).filter(Boolean))];
  months.sort((a, b) => MONTHS_ORDER.indexOf(a.toUpperCase()) - MONTHS_ORDER.indexOf(b.toUpperCase()));
  const mSel = document.getElementById('ib-filter-month');
  const prevMonth = mSel.value;
  mSel.innerHTML = '<option value="">Semua</option>';
  months.forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = m.charAt(0) + m.slice(1).toLowerCase();
    mSel.appendChild(o);
  });
  if (months.includes(prevMonth)) mSel.value = prevMonth;

  const dates = [...new Set(filtered.map(r => (r['TGL'] || '').trim()).filter(Boolean))].sort((a, b) => {
    const pa = a.split('/'), pb = b.split('/');
    return new Date(pb[2], pb[1]-1, pb[0]) - new Date(pa[2], pa[1]-1, pa[0]);
  });
  const dSel = document.getElementById('ib-filter-date');
  const prevDate = dSel.value;
  const todayStr = getTodayString();
  dSel.innerHTML = '<option value="">Semua</option>';
  dates.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d === todayStr ? `${d} (Hari Ini)` : d;
    dSel.appendChild(o);
  });
  if (dates.includes(prevDate)) dSel.value = prevDate;

  const techs = [...new Set(filtered.map(r => r['TEKNISI']).filter(Boolean))].sort();
  const tSel = document.getElementById('ib-filter-tech');
  const prevTech = tSel.value;
  tSel.innerHTML = '<option value="">Semua</option>';
  techs.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    tSel.appendChild(o);
  });
  if (techs.includes(prevTech)) tSel.value = prevTech;
}

function ibPopulateFilters() {
  const years = [...new Set(ibAllData.map(r => ibGetYear(r['TGL'])).filter(Boolean))].sort((a,b) => b - a);
  const ySel = document.getElementById('ib-filter-year');
  const prevYear = ySel.value;
  ySel.innerHTML = '<option value="">Semua</option>';
  years.forEach(y => {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    ySel.appendChild(o);
  });
  if (prevYear) ySel.value = prevYear;
  ibUpdateFilters();
}

/* ── INDIBIZ KPI ── */
function ibRenderKPI(data) {
  const total = data.length;
  const complete = data.filter(r => ibNormalizeStatus(r['STATUS']) === 'Complete').length;
  const revoke = data.filter(r => ibNormalizeStatus(r['STATUS']) === 'Revoke Complete').length;
  const cancel = data.filter(r => {
    const n = ibNormalizeStatus(r['STATUS']);
    return n.includes('Cancel') || n.includes('OSS');
  }).length;
  const pct = total > 0 ? Math.round(complete / total * 100) : 0;
  const pctTarget = Math.round(Math.min(complete / IB_TARGET * 100, 100));

  document.getElementById('ib-kpi-grid').innerHTML = `
    <div class="kpi-card kpi-dark"><div class="kpi-label">Total Order</div><div class="kpi-value">${total}</div><div class="kpi-sub">semua status</div></div>
    <div class="kpi-card kpi-green">
      <div class="kpi-label">Complete (PS)</div>
      <div class="kpi-value">${complete}</div>
      <div class="progress-label">Target ${IB_TARGET} · ${pctTarget}% tercapai</div>
      <div class="progress-bg"><div class="progress-fill" style="width:${pctTarget}%"></div></div>
    </div>
    <div class="kpi-card ${pct >= 70 ? 'kpi-green' : pct >= 50 ? 'kpi-amber' : 'kpi-red'}">
      <div class="kpi-label">Completion Rate</div><div class="kpi-value">${pct}%</div><div class="kpi-sub">dari total order</div>
    </div>
    <div class="kpi-card kpi-amber"><div class="kpi-label">Revoke</div><div class="kpi-value">${revoke}</div><div class="kpi-sub">order di-revoke</div></div>
    <div class="kpi-card kpi-red"><div class="kpi-label">Cancel</div><div class="kpi-value">${cancel}</div><div class="kpi-sub">cancel & OSS</div></div>
    <div class="kpi-card ${pct >= 70 ? 'kpi-green' : pct >= 50 ? 'kpi-amber' : 'kpi-red'}">
      <div class="kpi-label">REALISASI PS</div><div class="kpi-value">${pct}%</div><div class="kpi-sub">${complete} PS dari ${total} order</div>
    </div>`;
}

/* ── INDIBIZ Today Table ── */
function ibRenderToday() {
  const todayFull = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const year  = document.getElementById('ib-filter-year').value;
  const month = document.getElementById('ib-filter-month').value;
  const date  = document.getElementById('ib-filter-date').value;
  const tech  = document.getElementById('ib-filter-tech').value;

  let label = todayFull;
  if (date) label = `Tanggal ${date}`;
  else if (month && year) label = `${month.charAt(0)+month.slice(1).toLowerCase()} ${year}`;
  else if (month) label = month.charAt(0)+month.slice(1).toLowerCase();
  else if (year) label = year;
  document.getElementById('ib-today-label').textContent = label;

  const todayStr = getTodayString();
  const filtered = ibAllData.filter(r => {
    if (year  && ibGetYear(r['TGL']) !== year) return false;
    if (month && r['BULAN'] !== month) return false;
    if (date) { if ((r['TGL'] || '').trim() !== date) return false; }
    else if (!year && !month) { if ((r['TGL'] || '').trim() !== todayStr) return false; }
    if (tech  && r['TEKNISI'] !== tech) return false;
    return true;
  });

  const search = (document.getElementById('ib-search-today').value || '').toLowerCase();
  const data = search ? filtered.filter(r =>
    [r['NO ORDER'], r['STATUS'], r['PAKET'], r['TEKNISI'], r['UPDATE'], r['DETAIL KETERANGAN'], r['NO INTERNET / NO TELP']].join(' ').toLowerCase().includes(search)
  ) : filtered;

  const completeCount = data.filter(r => ibNormalizeStatus(r['STATUS']) === 'Complete').length;
  document.getElementById('ib-today-count').textContent = `${data.length} order · ${completeCount} complete`;

  const tbody = document.getElementById('ib-tbody-today');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="td-center">Tidak ada data untuk filter ini</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r['TGL'] || '-'}</td>
      <td title="${r['PAKET'] || ''}">${r['PAKET'] || '-'}</td>
      <td class="mono">${r['NO ORDER'] || '-'}</td>
      <td class="mono">${r['NO INTERNET / NO TELP'] || r['NO INTERNET'] || r['NO TELP'] || '-'}</td>
      <td>${ibStatusBadge(r['STATUS'])}</td>
      <td title="${r['UPDATE'] || ''}" style="white-space:normal;word-break:break-word;line-height:1.4;">${r['UPDATE'] || '-'}</td>
      <td title="${r['DETAIL KETERANGAN'] || ''}" style="max-width:220px;white-space:normal;word-break:break-word;line-height:1.4;">${r['DETAIL KETERANGAN'] || '-'}</td>
      <td>${r['BULAN'] ? (r['BULAN'].charAt(0)+r['BULAN'].slice(1).toLowerCase()) : '-'}</td>
      <td>${r['TANGGAL MANJA'] || '-'}</td>
      <td>${r['TEKNISI'] || '-'}</td>
    </tr>`).join('');
}

/* ── INDIBIZ Detail Table ── */
function ibRenderTable() {
  const filtered = ibGetFiltered();
  const search = (document.getElementById('ib-search-input').value || '').toLowerCase();
  const searched = search ? filtered.filter(r =>
    [r['NO ORDER'], r['STATUS'], r['PAKET'], r['BULAN'], r['TEKNISI'], r['UPDATE']].join(' ').toLowerCase().includes(search)
  ) : filtered;

  const show = searched.slice(0, 150);
  const tbody = document.getElementById('ib-table-body');
  if (show.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="td-center">Tidak ada data</td></tr>';
    document.getElementById('ib-table-count').textContent = '';
    return;
  }
  tbody.innerHTML = show.map(r => `
    <tr>
      <td>${r['TGL'] || '-'}</td>
      <td title="${r['PAKET'] || ''}">${r['PAKET'] || '-'}</td>
      <td class="mono">${r['NO ORDER'] || '-'}</td>
      <td>${r['BULAN'] ? (r['BULAN'].charAt(0)+r['BULAN'].slice(1).toLowerCase()) : '-'}</td>
      <td>${r['TEKNISI'] || '-'}</td>
      <td>${ibStatusBadge(r['STATUS'])}</td>
      <td title="${r['UPDATE'] || ''}" style="color:#5F5E5A;">${r['UPDATE'] || '-'}</td>
    </tr>`).join('');

  document.getElementById('ib-table-count').textContent =
    `Menampilkan ${show.length} dari ${searched.length} order` +
    (searched.length < filtered.length ? ` · filter aktif: ${filtered.length} data` : '');
}

/* ── INDIBIZ Charts ── */
function ibRenderCharts(data) {
  ibRenderMonthly(data);
  ibRenderStatus(data);
  ibRenderTech(data);
}

function ibRenderMonthly(data) {
  const monthMap = {};
  data.forEach(r => {
    const m = (r['BULAN'] || 'LAINNYA').toUpperCase().trim();
    if (!monthMap[m]) monthMap[m] = 0;
    if (ibNormalizeStatus(r['STATUS']) === 'Complete') monthMap[m]++;
  });
  const knownMonths = MONTHS_ORDER.filter(m => monthMap[m] !== undefined);
  const unknownMonths = Object.keys(monthMap).filter(m => !MONTHS_ORDER.includes(m));
  const months = [...knownMonths, ...unknownMonths];
  const completes = months.map(m => monthMap[m]);
  const labels = months.map(m => m.charAt(0) + m.slice(1).toLowerCase());

  if (ibCharts.monthly) ibCharts.monthly.destroy();
  ibCharts.monthly = new Chart(document.getElementById('ib-chart-monthly'), {
    type: 'bar',
    plugins: [ChartDataLabels],
    data: {
      labels,
      datasets: [
        { label: 'Complete', data: completes, backgroundColor: '#0F6E56', borderRadius: 5, barPercentage: 0.55,
          datalabels: { anchor: 'end', align: 'end', color: '#085041', font: { size: 11, weight: '600' }, formatter: v => v > 0 ? v : '' } },
        { label: 'Target (83)', data: months.map(() => IB_TARGET), type: 'line', borderColor: '#BA7517', borderDash: [6,4], borderWidth: 2, pointRadius: 0, fill: false, tension: 0, datalabels: { display: false } }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', color: '#085041', font: { size: 11, weight: '600' }, formatter: v => v > 0 ? v : '' } },
      scales: { x: { ticks: { autoSkip: false, maxRotation: 35, font: { size: 11 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } } }
    }
  });
}

function ibRenderStatus(data) {
  const statusMap = {};
  data.forEach(r => { const n = ibNormalizeStatus(r['STATUS']); statusMap[n] = (statusMap[n] || 0) + 1; });
  const labels = Object.keys(statusMap);
  const values = labels.map(k => statusMap[k]);
  const total = values.reduce((a, b) => a + b, 0);

  document.getElementById('ib-legend-status').innerHTML = labels.map((l, i) =>
    `<span class="legend-item"><span class="legend-dot" style="background:${STATUS_COLORS[i % STATUS_COLORS.length]};"></span>${l} (${values[i]})</span>`
  ).join('');

  if (ibCharts.status) ibCharts.status.destroy();
  ibCharts.status = new Chart(document.getElementById('ib-chart-status'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: STATUS_COLORS, borderWidth: 2, borderColor: '#fff', datalabels: { display: false } }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw / total * 100)}%)` } } } }
  });
}

function ibRenderTech(data) {
  const techMap = {};
  data.filter(r => ibNormalizeStatus(r['STATUS']) === 'Complete' && (r['TEKNISI'] || '').trim())
    .forEach(r => { const t = r['TEKNISI'].trim(); techMap[t] = (techMap[t] || 0) + 1; });
  const entries = Object.entries(techMap).sort((a, b) => b[1] - a[1]);
  const tLabels = entries.map(e => e[0]);
  const tData = entries.map(e => e[1]);
  const minH = Math.max(200, tLabels.length * 38 + 60);
  const wrap = document.getElementById('ib-tech-chart-wrap');
  wrap.style.height = minH + 'px';

  if (ibCharts.tech) { ibCharts.tech.destroy(); ibCharts.tech = null; }
  if (tLabels.length === 0) {
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:#888">Tidak ada data teknisi</div>';
    return;
  }
  // Pastikan canvas ada
  if (!document.getElementById('ib-chart-tech')) {
    wrap.innerHTML = '<canvas id="ib-chart-tech"></canvas>';
  }
  ibCharts.tech = new Chart(document.getElementById('ib-chart-tech'), {
    type: 'bar',
    data: { labels: tLabels, datasets: [{ label: 'Complete', data: tData, backgroundColor: '#185FA5', borderRadius: 4, barPercentage: 0.6, datalabels: { display: false } }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } } }
  });
}

/* ── INDIBIZ Load Data ── */
async function ibLoadData() {
  document.getElementById('last-update').textContent = 'Memuat data INDIBIZ...';
  try {
    const res = await fetch(IB_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { rows } = parseCSV(text);
    ibAllData = rows.filter(r => r['TGL'] || r['NO ORDER']);
    const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('last-update').textContent = `INDIBIZ · ${now} · ${ibAllData.length} baris`;
    ibPopulateFilters();
    ibApplyFilter();
    startCountdown();
  } catch (e) {
    document.getElementById('last-update').textContent = 'Gagal memuat data INDIBIZ';
    console.error(e);
  }
}

/* ============================================================
   ========================= TSEL ============================
============================================================ */

/* ── Normalizer Status BIMA ── */
function tselBimaBadge(s) {
  const u = (s || '').toUpperCase().trim();
  if (u === 'COMPWORK') return `<span class="badge badge-compwork">COMPWORK</span>`;
  if (u === 'CANCLWORK') return `<span class="badge badge-canclwork">CANCLWORK</span>`;
  if (u === 'WAPPR') return `<span class="badge badge-wappr">WAPPR</span>`;
  if (u === 'WORKFAIL') return `<span class="badge badge-workfail">WORKFAIL</span>`;
  if (u === 'STARTWORK') return `<span class="badge badge-startwork">STARTWORK</span>`;
  return `<span class="badge badge-other">${s || '-'}</span>`;
}

function tselQc2Badge(s) {
  const u = (s || '').toUpperCase().trim();
  if (u === 'OK') return `<span class="badge badge-qc2-ok">OK</span>`;
  return `<span class="badge badge-other">${s || '-'}</span>`;
}

/* ── TSEL Filter Functions ── */
function tselApplyFilter() {
  const month  = document.getElementById('tsel-filter-month').value;
  const year   = document.getElementById('tsel-filter-year').value;
  const date   = document.getElementById('tsel-filter-date') ? document.getElementById('tsel-filter-date').value : '';
  const status = document.getElementById('tsel-filter-status').value;
  const tech   = document.getElementById('tsel-filter-tech').value;

  // Update date dropdown when month/year changes
  tselUpdateDateFilter();

  tselFilteredData = tselAllData.filter(r => {
    const dB = parseTselDate(r['_COL_B']); // Tgl Order BIMA
    if (month && dB) {
      if (String(dB.getMonth() + 1) !== month) return false;
    }
    if (year && dB) {
      if (String(dB.getFullYear()) !== year) return false;
    }
    if (date && dB) {
      const dStr = `${String(dB.getDate()).padStart(2,'0')}/${String(dB.getMonth()+1).padStart(2,'0')}/${dB.getFullYear()}`;
      if (dStr !== date) return false;
    }
    if (status) {
      if ((r['_COL_H'] || '').toUpperCase().trim() !== status) return false;
    }
    if (tech) {
      if ((r['_COL_X'] || '').trim() !== tech) return false;
    }
    return true;
  });

  tselRenderKPI();
  tselRenderSetting();
  tselRenderTotal();
  tselRenderCharts();
}

function tselPopulateFilters() {
  // Teknisi options dari data
  const techs = [...new Set(tselAllData.map(r => (r['_COL_X'] || '').trim()).filter(Boolean))].sort();
  const tSel = document.getElementById('tsel-filter-tech');
  if (tSel) {
    const prev = tSel.value;
    tSel.innerHTML = '<option value="">Semua Teknisi</option>';
    techs.forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      tSel.appendChild(o);
    });
    if (prev) tSel.value = prev;
  }

  // Set tahun default ke tahun sekarang
  const ySel = document.getElementById('tsel-filter-year');
  if (ySel && !ySel.value) {
    ySel.value = String(new Date().getFullYear());
  }

  // Set bulan default ke bulan sekarang
  const mSel = document.getElementById('tsel-filter-month');
  if (mSel && !mSel.value) {
    mSel.value = String(new Date().getMonth() + 1);
  }

  // Populate filter tanggal dari data
  tselUpdateDateFilter();
}

function tselUpdateDateFilter() {
  const month = document.getElementById('tsel-filter-month').value;
  const year  = document.getElementById('tsel-filter-year').value;

  const dates = [...new Set(tselAllData
    .filter(r => {
      const d = parseTselDate(r['_COL_B']);
      if (!d) return false;
      if (month && String(d.getMonth()+1) !== month) return false;
      if (year  && String(d.getFullYear()) !== year) return false;
      return true;
    })
    .map(r => {
      const d = parseTselDate(r['_COL_B']);
      return d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : null;
    })
    .filter(Boolean)
  )].sort((a, b) => {
    const pa = a.split('/'), pb = b.split('/');
    return new Date(pb[2], pb[1]-1, pb[0]) - new Date(pa[2], pa[1]-1, pa[0]);
  });

  const dSel = document.getElementById('tsel-filter-date');
  if (dSel) {
    const prev = dSel.value;
    const todayStr = getTodayString();
    dSel.innerHTML = '<option value="">Semua Tanggal</option>';
    dates.forEach(d => {
      const o = document.createElement('option');
      o.value = d;
      o.textContent = d === todayStr ? `${d} (Hari Ini)` : d;
      dSel.appendChild(o);
    });
    if (dates.includes(prev)) dSel.value = prev;
  }
}

/* ── Parse tanggal TSEL ── */
// Tanggal di sheet bisa dalam berbagai format. Coba parse flexibel.
function parseTselDate(str) {
  if (!str) return null;
  str = str.trim();
  // Format DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return new Date(y, m-1, d);
  }
  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str);
  }
  // Format MM/DD/YYYY (US style dari Google Sheets)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    return new Date(parts[2], parts[0]-1, parts[1]);
  }
  return null;
}

function tselDateToDisplay(str) {
  if (!str) return '-';
  const d = parseTselDate(str);
  if (!d) return str;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function isTodayTsel(str) {
  if (!str) return false;
  const d = parseTselDate(str);
  if (!d) return false;
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isCurrentMonthTsel(str) {
  if (!str) return false;
  const d = parseTselDate(str);
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/* ── TSEL KPI Render ── */
function tselRenderKPI() {
  const data = tselFilteredData.length > 0 ? tselFilteredData : tselAllData;

  // ── KPI HARIAN ──
  // Order hari ini = baris yang Tgl Order BIMA (kolom B) = hari ini
  const orderHariIni = tselAllData.filter(r => isTodayTsel(r['_COL_B']));

  // Setting hari ini = baris yang Tgl Setting (kolom A) = hari ini
  const settingHariIni = tselAllData.filter(r => isTodayTsel(r['_COL_A']));

  // COMPWORK hari ini = dari settingHariIni yang Status BIMA = COMPWORK
  const compworkHariIni = settingHariIni.filter(r => (r['_COL_H'] || '').toUpperCase().trim() === 'COMPWORK');

  // RE/PS harian = COMPWORK setting hari ini / total setting hari ini
  const rePS_harian = settingHariIni.length > 0
    ? Math.round((compworkHariIni.length / settingHariIni.length) * 100)
    : 0;
  const color_harian = rePS_harian >= 70 ? 'kpi-green' : rePS_harian >= 50 ? 'kpi-amber' : 'kpi-red';

  // Produktifitas harian = COMPWORK setting hari ini / teknisi hadir
  const prodHarian = tselTeknisiHadir > 0
    ? (compworkHariIni.length / tselTeknisiHadir).toFixed(2)
    : compworkHariIni.length;

  document.getElementById('tsel-kpi-harian').innerHTML = `
    <div class="kpi-card kpi-dark">
      <div class="kpi-label">Order Hari Ini</div>
      <div class="kpi-value">${orderHariIni.length}</div>
      <div class="kpi-sub">dari Tgl Order BIMA</div>
    </div>
    <div class="kpi-card kpi-blue">
      <div class="kpi-label">Setting Hari Ini</div>
      <div class="kpi-value">${settingHariIni.length}</div>
      <div class="kpi-sub">dari Tgl Setting (kol A)</div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-label">COMPWORK Hari Ini</div>
      <div class="kpi-value">${compworkHariIni.length}</div>
      <div class="kpi-sub">dari setting hari ini</div>
    </div>
    <div class="kpi-card kpi-dark">
      <div class="kpi-label">Teknisi Hadir</div>
      <div class="kpi-value">${tselTeknisiHadir}</div>
      <div class="kpi-sub">sheet Teknisi Hari Ini</div>
    </div>
    <div class="kpi-card ${color_harian}">
      <div class="kpi-label">RE/PS Hari Ini</div>
      <div class="kpi-value">${rePS_harian}%</div>
      <div class="progress-bg"><div class="progress-fill" style="width:${rePS_harian}%;background:#CC0000;"></div></div>
      <div class="kpi-sub">${compworkHariIni.length} COMPWORK / ${settingHariIni.length} setting</div>
    </div>
    <div class="kpi-card kpi-blue">
      <div class="kpi-label">Produktifitas</div>
      <div class="kpi-value">${prodHarian}</div>
      <div class="kpi-sub">COMPWORK/teknisi · ${tselTeknisiHadir} hadir</div>
    </div>`;

  // ── KPI BULANAN (mengikuti filter bulan/tahun) ──
  // Order bulan ini = dari filtered data, Tgl Order BIMA (kolom B) ada
  const orderBulan = data.filter(r => r['_COL_B']);

  // COMPWORK bulan ini = dari orderBulan yang Status BIMA = COMPWORK
  const compworkBulan = orderBulan.filter(r => (r['_COL_H'] || '').toUpperCase().trim() === 'COMPWORK');
  const canclBulan    = orderBulan.filter(r => (r['_COL_H'] || '').toUpperCase().trim() === 'CANCLWORK');
  const wapprBulan    = orderBulan.filter(r => (r['_COL_H'] || '').toUpperCase().trim() === 'WAPPR');
  const failBulan     = orderBulan.filter(r => (r['_COL_H'] || '').toUpperCase().trim() === 'WORKFAIL');

  // RE/PS bulan = COMPWORK bulan / total order bulan (dari Tgl Order BIMA)
  const rePS_bulan = orderBulan.length > 0
    ? Math.round((compworkBulan.length / orderBulan.length) * 100)
    : 0;
  const color_bulan = rePS_bulan >= 70 ? 'kpi-green' : rePS_bulan >= 50 ? 'kpi-amber' : 'kpi-red';

  // Produktifitas bulanan = COMPWORK bulan / teknisi hadir
  const prodBulan = tselTeknisiHadir > 0
    ? (compworkBulan.length / tselTeknisiHadir).toFixed(2)
    : compworkBulan.length;

  // Label periode
  const mSel = document.getElementById('tsel-filter-month');
  const ySel = document.getElementById('tsel-filter-year');
  const bulanLabel = mSel && mSel.options[mSel.selectedIndex] ? mSel.options[mSel.selectedIndex].text : '';
  const tahunLabel = ySel ? ySel.value : '';
  const periodLabel = [bulanLabel, tahunLabel].filter(Boolean).join(' ') || 'Semua Data';

  document.getElementById('tsel-kpi-bulanan').innerHTML = `
    <div class="kpi-card kpi-dark">
      <div class="kpi-label">Total Order Bulan Ini</div>
      <div class="kpi-value">${orderBulan.length}</div>
      <div class="kpi-sub">${periodLabel} · Tgl Order BIMA</div>
    </div>
    <div class="kpi-card kpi-dark">
      <div class="kpi-label">Total Status BIMA</div>
      <div class="kpi-value">${orderBulan.length}</div>
      <div class="kpi-sub">dari Tgl Order BIMA</div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-label">COMPWORK Bulan Ini</div>
      <div class="kpi-value">${compworkBulan.length}</div>
      <div class="kpi-sub">selesai · ${Math.round(compworkBulan.length/Math.max(orderBulan.length,1)*100)}%</div>
    </div>
    <div class="kpi-card ${color_bulan}">
      <div class="kpi-label">RE/PS Bulan Ini</div>
      <div class="kpi-value">${rePS_bulan}%</div>
      <div class="progress-bg"><div class="progress-fill" style="width:${rePS_bulan}%;background:#CC0000;"></div></div>
      <div class="kpi-sub">${compworkBulan.length} COMPWORK / ${orderBulan.length} order</div>
    </div>
    <div class="kpi-card kpi-blue">
      <div class="kpi-label">Produktifitas Bulan Ini</div>
      <div class="kpi-value">${prodBulan}</div>
      <div class="kpi-sub">COMPWORK/teknisi · ${tselTeknisiHadir} hadir</div>
    </div>
    <div class="kpi-card kpi-amber">
      <div class="kpi-label">CANCLWORK / FAIL</div>
      <div class="kpi-value">${canclBulan.length + failBulan.length}</div>
      <div class="kpi-sub">cancel: ${canclBulan.length} · fail: ${failBulan.length}</div>
    </div>`;
}

/* ── TSEL Table: Setting Hari Ini (editable) ── */
function tselRenderSetting() {
  // Selalu tampilkan data setting HARI INI (tidak kena filter bulan/tahun)
  const data = tselAllData.filter(r => isTodayTsel(r['_COL_A']));
  const tbody = document.getElementById('tsel-tbody-setting');
  document.getElementById('tsel-count-setting').textContent = `${data.length} order setting hari ini`;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="td-center">Tidak ada order setting hari ini</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((r) => {
    const rowIdx = r['_ROW_INDEX'];
    return `<tr>
      <td>${tselDateToDisplay(r['_COL_A'])}</td>
      <td>${tselDateToDisplay(r['_COL_B'])}</td>
      <td class="mono">${r['_COL_C'] || '-'}</td>
      <td class="mono">${r['_COL_D'] || '-'}</td>
      <td>${r['_COL_G'] || '-'}</td>
      <td class="editable-cell" onclick="tselOpenEdit(this, 'STATUS_BIMA', ${rowIdx}, '${(r['_COL_H']||'').replace(/'/g,"\\'")}')">
        ${tselBimaBadge(r['_COL_H'])}
      </td>
      <td class="editable-cell" onclick="tselOpenEdit(this, 'TEKNISI', ${rowIdx}, '${(r['_COL_X']||'').replace(/'/g,"\\'")}')">
        ${r['_COL_X'] || '<span style="color:#aaa">— pilih —</span>'}
      </td>
      <td class="editable-cell" onclick="tselOpenEdit(this, 'QC2', ${rowIdx}, '${(r['_COL_Y']||'').replace(/'/g,"\\'")}')">
        ${tselQc2Badge(r['_COL_Y'])}
      </td>
    </tr>`;
  }).join('');
}

/* ── TSEL Table: Total Order (editable, ikut filter) ── */
function tselRenderTotal() {
  const search = (document.getElementById('tsel-search-total').value || '').toLowerCase();
  // Gunakan filtered data jika ada, otherwise semua
  let data = tselFilteredData.length > 0 ? [...tselFilteredData] : [...tselAllData];
  if (search) {
    data = data.filter(r =>
      [r['_COL_C'], r['_COL_D'], r['_COL_G'], r['_COL_H'], r['_COL_X'], r['_COL_Y'],
       tselDateToDisplay(r['_COL_A']), tselDateToDisplay(r['_COL_B'])].join(' ').toLowerCase().includes(search)
    );
  }
  const show = data.slice(0, 300);
  const tbody = document.getElementById('tsel-tbody-total');
  document.getElementById('tsel-count-total').textContent = `Menampilkan ${show.length} dari ${data.length} order`;

  if (show.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="td-center">Tidak ada data untuk filter ini</td></tr>';
    return;
  }

  tbody.innerHTML = show.map(r => {
    const rowIdx = r['_ROW_INDEX'];
    return `<tr>
      <td class="editable-cell" onclick="tselOpenEditDate(this, 'TGL_SETTING', ${rowIdx}, '${(r['_COL_A']||'').replace(/'/g,"\\'")}')">
        ${tselDateToDisplay(r['_COL_A']) || '<span style="color:#aaa">— isi —</span>'}
      </td>
      <td>${tselDateToDisplay(r['_COL_B'])}</td>
      <td class="mono">${r['_COL_C'] || '-'}</td>
      <td class="mono">${r['_COL_D'] || '-'}</td>
      <td>${r['_COL_G'] || '-'}</td>
      <td class="editable-cell" onclick="tselOpenEdit(this, 'STATUS_BIMA', ${rowIdx}, '${(r['_COL_H']||'').replace(/'/g,"\\'")}')">
        ${tselBimaBadge(r['_COL_H'])}
      </td>
      <td class="editable-cell" onclick="tselOpenEdit(this, 'TEKNISI', ${rowIdx}, '${(r['_COL_X']||'').replace(/'/g,"\\'")}')">
        ${r['_COL_X'] || '<span style="color:#aaa">— pilih —</span>'}
      </td>
      <td class="editable-cell" onclick="tselOpenEdit(this, 'QC2', ${rowIdx}, '${(r['_COL_Y']||'').replace(/'/g,"\\'")}')">
        ${tselQc2Badge(r['_COL_Y'])}
      </td>
    </tr>`;
  }).join('');
}

/* ── TSEL Charts ── */
function tselRenderCharts() {
  const data = tselFilteredData.length > 0 ? tselFilteredData : tselAllData;

  // Chart 1: Status BIMA Donut
  const statusMap = {};
  data.forEach(r => {
    const s = (r['_COL_H'] || 'Lainnya').toUpperCase().trim() || 'Lainnya';
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const sLabels = Object.keys(statusMap);
  const sValues = sLabels.map(k => statusMap[k]);
  const sTotal  = sValues.reduce((a, b) => a + b, 0);
  const sCols   = ['#0F6E56','#CC0000','#EF9F27','#185FA5','#8B0000','#888780'];

  document.getElementById('tsel-legend-status').innerHTML = sLabels.map((l, i) =>
    `<span class="legend-item"><span class="legend-dot" style="background:${sCols[i % sCols.length]};"></span>${l} (${statusMap[l]})</span>`
  ).join('');

  if (tselCharts.status) { tselCharts.status.destroy(); tselCharts.status = null; }
  const ctxS = document.getElementById('tsel-chart-status');
  if (ctxS && sLabels.length > 0) {
    tselCharts.status = new Chart(ctxS, {
      type: 'doughnut',
      data: { labels: sLabels, datasets: [{ data: sValues, backgroundColor: sCols, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/sTotal*100)}%)` } },
          datalabels: { display: false }
        }
      }
    });
  }

  // Chart 2: COMPWORK per Teknisi
  const techMap = {};
  data.filter(r => (r['_COL_H']||'').toUpperCase().trim() === 'COMPWORK' && (r['_COL_X']||'').trim())
    .forEach(r => { const t = r['_COL_X'].trim(); techMap[t] = (techMap[t] || 0) + 1; });
  const tEntries = Object.entries(techMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const tLabels  = tEntries.map(e => e[0].replace('JTN | ', ''));
  const tValues  = tEntries.map(e => e[1]);

  const wrap = document.getElementById('tsel-tech-chart-wrap');
  const minH = Math.max(200, tLabels.length * 36 + 60);
  if (wrap) wrap.style.height = minH + 'px';

  if (tselCharts.tech) { tselCharts.tech.destroy(); tselCharts.tech = null; }
  if (!document.getElementById('tsel-chart-tech') && wrap) {
    wrap.innerHTML = '<canvas id="tsel-chart-tech"></canvas>';
  }
  const ctxT = document.getElementById('tsel-chart-tech');
  if (ctxT && tLabels.length > 0) {
    tselCharts.tech = new Chart(ctxT, {
      type: 'bar',
      data: { labels: tLabels, datasets: [{ label: 'COMPWORK', data: tValues, backgroundColor: '#CC0000', borderRadius: 4, barPercentage: 0.6 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  } else if (wrap && tLabels.length === 0) {
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:#888">Belum ada data COMPWORK</div>';
  }
}


function tselOpenEdit(cell, fieldType, rowIndex, currentVal) {
  // Jika sudah ada select di cell ini, batalkan
  if (cell.querySelector('select')) return;

  let options = [];
  if (fieldType === 'STATUS_BIMA') options = TSEL_STATUS_BIMA_OPTIONS;
  else if (fieldType === 'TEKNISI') options = TSEL_TEKNISI_OPTIONS;
  else if (fieldType === 'QC2') options = TSEL_QC2_OPTIONS;

  const sel = document.createElement('select');
  sel.className = 'inline-select';
  sel.innerHTML = `<option value="">-- Pilih --</option>` +
    options.map(o => `<option value="${o}" ${o === currentVal ? 'selected' : ''}>${o}</option>`).join('');

  sel.onchange = async function(e) {
    e.stopPropagation();
    const newVal = sel.value;
    if (!newVal) { cell.innerHTML = restoreCell(fieldType, currentVal); return; }
    cell.innerHTML = '<span class="saving-indicator">Menyimpan...</span>';
    const ok = await tselUpdateCell(rowIndex, fieldType, newVal);
    if (ok) {
      // Update local data
      const rowData = tselAllData.find(r => r['_ROW_INDEX'] === rowIndex);
      if (rowData) {
        if (fieldType === 'STATUS_BIMA') rowData['_COL_H'] = newVal;
        else if (fieldType === 'TEKNISI') rowData['_COL_X'] = newVal;
        else if (fieldType === 'QC2') rowData['_COL_Y'] = newVal;
      }
      // Re-render semua (apply filter juga update chart)
      tselApplyFilter();
      showToast(`✓ Berhasil update ${fieldType} → ${newVal}`);
    } else {
      cell.innerHTML = restoreCell(fieldType, currentVal);
      showToast(`✗ Gagal update. Cek koneksi.`, true);
    }
  };

  sel.onblur = function() {
    setTimeout(() => { if (cell.contains(sel)) cell.innerHTML = restoreCell(fieldType, currentVal); }, 200);
  };

  cell.innerHTML = '';
  cell.appendChild(sel);
  sel.focus();
}

function tselOpenEditDate(cell, fieldType, rowIndex, currentVal) {
  if (cell.querySelector('input')) return;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'inline-select';
  inp.value = currentVal;
  inp.placeholder = 'DD/MM/YYYY';
  inp.style.width = '110px';

  inp.onblur = async function() {
    const newVal = inp.value.trim();
    if (!newVal || newVal === currentVal) { cell.textContent = tselDateToDisplay(currentVal); return; }
    cell.innerHTML = '<span class="saving-indicator">Menyimpan...</span>';
    const ok = await tselUpdateCell(rowIndex, fieldType, newVal);
    if (ok) {
      const rowData = tselAllData.find(r => r['_ROW_INDEX'] === rowIndex);
      if (rowData) rowData['_COL_A'] = newVal;
      tselApplyFilter();
      showToast(`✓ Berhasil update Tanggal Setting → ${newVal}`);
    } else {
      cell.textContent = tselDateToDisplay(currentVal);
      showToast(`✗ Gagal update. Cek koneksi.`, true);
    }
  };

  inp.onkeydown = function(e) { if (e.key === 'Escape') { cell.textContent = tselDateToDisplay(currentVal); } };

  cell.innerHTML = '';
  cell.appendChild(inp);
  inp.focus();
  inp.select();
}

function restoreCell(fieldType, val) {
  if (fieldType === 'STATUS_BIMA') return tselBimaBadge(val);
  if (fieldType === 'QC2') return tselQc2Badge(val);
  return val || '-';
}

/* ── TSEL Update ke Google Sheets via Apps Script ── */
async function tselUpdateCell(rowIndex, fieldType, newValue) {
  // Mapping field ke kolom spreadsheet
  const colMap = {
    'TGL_SETTING': 'A',
    'STATUS_BIMA': 'H',
    'TEKNISI': 'X',
    'QC2': 'Y'
  };
  const col = colMap[fieldType];
  if (!col) return false;

  // Cek apakah Apps Script URL sudah dikonfigurasi
  if (!TSEL_APPS_SCRIPT_URL || TSEL_APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('Apps Script URL belum dikonfigurasi di app.js');
    // Untuk testing, simulate success
    // Uncomment baris berikut jika ingin test UI tanpa Apps Script:
    // return true;
    return false;
  }

  try {
    const payload = {
      action: 'update',
      sheet: 'DATA RE JTN',
      row: rowIndex,
      col: col,
      value: newValue
    };
    const res = await fetch(TSEL_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.status === 'ok' || data.result === 'success';
  } catch (e) {
    console.error('Update error:', e);
    return false;
  }
}

/* ── TSEL Load Data ── */
async function loadTselData() {
  document.getElementById('last-update').textContent = 'Memuat data TSEL...';
  tselAllData = [];
  tselTeknisiHadir = 0;

  try {
    // Load sheet DATA RE JTN
    const res = await fetch(TSEL_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { header, rows } = parseCSV(text);

    // Spreadsheet punya 2 baris header:
    // Baris 1 = judul kategori (X, UPDATE MANU, DATA AREA) → ini yang dibaca parseCSV sebagai header
    // Baris 2 = nama kolom (Tanggal Setting, Tanggal Order B, dst) → ini jadi row pertama di rows[]
    // Baris 3+ = data sebenarnya
    // Jadi kita skip rows[0] (yang isinya nama kolom), data mulai rows[1]

    const dataRows = rows.slice(1); // skip baris header kedua
    tselAllData = dataRows.map((r, idx) => {
      const vals = Object.values(r);
      return {
        _ROW_INDEX: idx + 3, // row 3 di spreadsheet = index 0 di dataRows
        _COL_A: vals[0]  || '', // Tanggal Setting
        _COL_B: vals[1]  || '', // Tanggal Order BIMA
        _COL_C: vals[2]  || '', // Workorder PSB
        _COL_D: vals[3]  || '', // Workorder ODP Validation
        _COL_E: vals[4]  || '', // SC Order No
        _COL_F: vals[5]  || '', // Service No
        _COL_G: vals[6]  || '', // CRM Order Type
        _COL_H: vals[7]  || '', // Status BIMA
        _COL_P: vals[15] || '', // Progress
        _COL_X: vals[23] || '', // Regu/Teknisi
        _COL_Y: vals[24] || '', // Status QC2
        _RAW: r
      };
    }).filter(r => r['_COL_B'] || r['_COL_C']); // filter baris yang punya data

    // Load sheet TEKNISI HARI INI
    try {
      const resT = await fetch(TSEL_TEKNISI_CSV_URL);
      if (resT.ok) {
        const textT = await resT.text();
        const { rows: rowsT } = parseCSV(textT);
        // Asumsi: sheet ini berisi daftar teknisi yang hadir hari ini
        // Hitung baris yang berisi nama teknisi (non-kosong)
        // Skip 3 baris pertama (kosong/judul/tanggal)
        // Data teknisi mulai baris ke-4 (baris 5 di sheet = index 3 setelah parseCSV skip baris 1)
        const dataRowsT = rowsT.slice(3);
        tselTeknisiHadir = dataRowsT.filter(r => {
          const vals = Object.values(r);
          return vals.some(v => v && v.trim());
        }).length;
      }
    } catch (e2) {
      console.warn('Tidak bisa load sheet TEKNISI HARI INI:', e2);
      tselTeknisiHadir = 0;
    }

    const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('last-update').textContent = `TSEL · ${now} · ${tselAllData.length} baris`;
    tselPopulateFilters();
    tselApplyFilter();
    startCountdown();
  } catch (e) {
    document.getElementById('last-update').textContent = 'Gagal memuat data TSEL';
    console.error(e);
    document.getElementById('tsel-tbody-setting').innerHTML = `<tr><td colspan="8" class="td-center" style="color:#A32D2D;">Gagal memuat data TSEL.<br><small>${e.message}</small><br><small>Pastikan sheet "DATA RE JTN" sudah dipublish sebagai CSV.</small></td></tr>`;
    document.getElementById('tsel-tbody-total').innerHTML = `<tr><td colspan="8" class="td-center" style="color:#A32D2D;">Gagal memuat data TSEL.<br><small>${e.message}</small></td></tr>`;
  }
}

/* ============================================================
   AUTO REFRESH
============================================================ */
let countdown = 300;
function startCountdown() {
  countdown = 300;
  const el = document.getElementById('countdown');
  clearInterval(window._cdInterval);
  window._cdInterval = setInterval(() => {
    countdown--;
    if (el) {
      const menit = Math.floor(countdown / 60);
      const detik = countdown % 60;
      el.textContent = `· refresh dalam ${menit}m ${String(detik).padStart(2,'0')}s`;
    }
    if (countdown <= 0) clearInterval(window._cdInterval);
  }, 1000);
}

setInterval(() => { loadCurrentTab(); }, 300000);

/* ============================================================
   INIT
============================================================ */
ibLoadData();
