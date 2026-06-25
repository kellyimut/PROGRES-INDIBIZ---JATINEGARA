const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTNMvUECIc8TJbeMynfITc5c03iYqp5I1lyqKZ27H7n82I6Z8RfPCSs1Axz-hGP1I0YfR6yjOYYO0U/pub?gid=1218838046&single=true&output=csv';

const TARGET = 83;
const MONTHS_ORDER = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
const STATUS_COLORS = ['#0F6E56','#EF9F27','#E24B4A','#378ADD','#D4537E','#888780'];

let allData = [];
let charts = {};

/* ── CSV Parser ── */
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const obj = {};
    header.forEach((h, j) => { obj[h] = (cols[j] || '').replace(/^"|"$/g, '').trim(); });
    if (obj['TGL'] || obj['NO ORDER']) rows.push(obj);
  }
  return rows;
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

/* ── Status Normalizer ── */
function normalizeStatus(s) {
  const u = (s || '').toUpperCase().trim();
  if (u === 'COMPLETE') return 'Complete';
  if (u.includes('REVOKE')) return 'Revoke Complete';
  if (u.includes('OSS')) return 'OSS Cancel Complete';
  if (u.includes('CANCEL BY SYSTEM')) return 'Cancel by System';
  if (u.includes('CANCEL BY FCC')) return 'Cancel by FCC';
  if (u.includes('CANCEL')) return 'Cancel';
  return s || 'Lainnya';
}

function statusBadge(s) {
  const n = normalizeStatus(s);
  if (n === 'Complete') return `<span class="badge badge-complete">Complete</span>`;
  if (n === 'Revoke Complete') return `<span class="badge badge-revoke">Revoke</span>`;
  if (n === 'OSS Cancel Complete') return `<span class="badge badge-oss">OSS Cancel</span>`;
  if (n.includes('Cancel')) return `<span class="badge badge-cancel">${n}</span>`;
  return `<span class="badge badge-other">${n}</span>`;
}

/* ── Filters ── */
let filterToday = false;

function toggleTodayFilter() {}

function getYear(tgl) {
  if (!tgl) return '';
  const parts = tgl.trim().split('/');
  if (parts.length === 3) return parts[2];
  return '';
}

function getFiltered() {
  const year  = document.getElementById('filter-year').value;
  const month = document.getElementById('filter-month').value;
  const date  = document.getElementById('filter-date').value;
  const tech  = document.getElementById('filter-tech').value;
  const search = (document.getElementById('search-input').value || '').toLowerCase();
  return allData.filter(r => {
    if (year  && getYear(r['TGL']) !== year) return false;
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

function applyFilter() {
  const data = getFiltered();
  renderKPI(data);
  renderCharts(data);
  renderTable();
  renderToday();
}

/* ── Scroll Helper ── */
function scrollTable(id, amount) {
  const el = document.getElementById(id);
  if (el) el.scrollBy({ left: amount, behavior: 'smooth' });
}

/* ── Today's Orders ── */
function getTodayString() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

function renderToday() {
  const todayFull = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const year  = document.getElementById('filter-year').value;
  const month = document.getElementById('filter-month').value;
  const date  = document.getElementById('filter-date').value;
  const tech  = document.getElementById('filter-tech').value;

  // Label section: sesuaikan judul dengan filter aktif
  let label = todayFull;
  if (date) label = `Tanggal ${date}`;
  else if (month && year) label = `${month.charAt(0)+month.slice(1).toLowerCase()} ${year}`;
  else if (month) label = month.charAt(0)+month.slice(1).toLowerCase();
  else if (year) label = year;
  document.getElementById('today-label').textContent = label;

  // Ambil data sesuai filter (sama dengan getFiltered tapi tanpa search)
  const todayStr = getTodayString();
  const filtered = allData.filter(r => {
    if (year  && getYear(r['TGL']) !== year) return false;
    if (month && r['BULAN'] !== month) return false;
    if (date) {
      if ((r['TGL'] || '').trim() !== date) return false;
    } else if (!year && !month) {
      // default: tampilkan hari ini saja
      if ((r['TGL'] || '').trim() !== todayStr) return false;
    }
    if (tech  && r['TEKNISI'] !== tech) return false;
    return true;
  });

  const search = (document.getElementById('search-today').value || '').toLowerCase();
  const data = search ? filtered.filter(r =>
    [r['NO ORDER'], r['STATUS'], r['PAKET'], r['TEKNISI'], r['UPDATE'], r['DETAIL KETERANGAN'], r['NO INTERNET / NO TELP']].join(' ').toLowerCase().includes(search)
  ) : filtered;

  const count = document.getElementById('today-count');
  const completeCount = data.filter(r => normalizeStatus(r['STATUS']) === 'Complete').length;
  count.textContent = `${data.length} order · ${completeCount} complete`;

  const tbody = document.getElementById('tbody-today');
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
      <td>${statusBadge(r['STATUS'])}</td>
      <td title="${r['UPDATE'] || ''}">${r['UPDATE'] || '-'}</td>
      <td title="${r['DETAIL KETERANGAN'] || ''}" style="max-width:250px; white-space:normal; word-break:break-word; line-height:1.4;">${r['DETAIL KETERANGAN'] || '-'}</td>
      <td>${r['BULAN'] ? (r['BULAN'].charAt(0) + r['BULAN'].slice(1).toLowerCase()) : '-'}</td>
      <td>${r['TANGGAL MANJA'] || '-'}</td>
      <td>${r['TEKNISI'] || '-'}</td>
    </tr>
  `).join('');
}

/* ── KPI ── */
function renderKPI(data) {
  const total = data.length;
  const complete = data.filter(r => normalizeStatus(r['STATUS']) === 'Complete').length;
  const revoke = data.filter(r => normalizeStatus(r['STATUS']) === 'Revoke Complete').length;
  const cancel = data.filter(r => {
    const n = normalizeStatus(r['STATUS']);
    return n.includes('Cancel') || n.includes('OSS');
  }).length;
  const pct = total > 0 ? Math.round(complete / total * 100) : 0;
  const pctTarget = Math.round(Math.min(complete / TARGET * 100, 100));
  const vsTarget = complete - TARGET;
  const vsSign = vsTarget >= 0 ? '+' : '';

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card kpi-dark">
      <div class="kpi-label">Total Order</div>
      <div class="kpi-value">${total}</div>
      <div class="kpi-sub">semua status</div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-label">Complete (PS)</div>
      <div class="kpi-value">${complete}</div>
      <div class="progress-label">Target ${TARGET} · ${pctTarget}% tercapai</div>
      <div class="progress-bg"><div class="progress-fill" style="width:${pctTarget}%"></div></div>
    </div>
    <div class="kpi-card ${pct >= 70 ? 'kpi-green' : pct >= 50 ? 'kpi-amber' : 'kpi-red'}">
      <div class="kpi-label">Completion Rate</div>
      <div class="kpi-value">${pct}%</div>
      <div class="kpi-sub">dari total order</div>
    </div>
    <div class="kpi-card kpi-amber">
      <div class="kpi-label">Revoke</div>
      <div class="kpi-value">${revoke}</div>
      <div class="kpi-sub">order di-revoke</div>
    </div>
    <div class="kpi-card kpi-red">
      <div class="kpi-label">Cancel</div>
      <div class="kpi-value">${cancel}</div>
      <div class="kpi-sub">cancel & OSS</div>
    </div>
    <div class="kpi-card ${vsTarget >= 0 ? 'kpi-green' : 'kpi-red'}">
      <div class="kpi-label">vs Target</div>
      <div class="kpi-value">${Math.round(complete / TARGET * 100)}%</div>
      <div class="kpi-sub">${vsSign}${vsTarget} dari target 83</div>
    </div>
  `;
}

/* ── Charts ── */
function renderCharts(data) {
  renderMonthly(data);
  renderStatus(data);
  renderTech(data);
}

function renderMonthly(data) {
  const monthMap = {};
  data.forEach(r => {
    const m = (r['BULAN'] || 'LAINNYA').toUpperCase().trim();
    if (!monthMap[m]) monthMap[m] = 0;
    if (normalizeStatus(r['STATUS']) === 'Complete') monthMap[m]++;
  });

  const knownMonths = MONTHS_ORDER.filter(m => monthMap[m] !== undefined);
  const unknownMonths = Object.keys(monthMap).filter(m => !MONTHS_ORDER.includes(m));
  const months = [...knownMonths, ...unknownMonths];

  const completes = months.map(m => monthMap[m]);
  const labels = months.map(m => m.charAt(0) + m.slice(1).toLowerCase());

  if (charts.monthly) charts.monthly.destroy();
  charts.monthly = new Chart(document.getElementById('chart-monthly'), {
    type: 'bar',
    plugins: [ChartDataLabels],
    data: {
      labels,
      datasets: [
        {
          label: 'Complete',
          data: completes,
          backgroundColor: '#0F6E56',
          borderRadius: 5,
          barPercentage: 0.55,
          datalabels: {
            anchor: 'end',
            align: 'end',
            color: '#085041',
            font: { size: 11, weight: '600' },
            formatter: v => v > 0 ? v : ''
          }
        },
        {
          label: 'Target (83)',
          data: months.map(() => TARGET),
          type: 'line',
          borderColor: '#BA7517',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#085041',
          font: { size: 11, weight: '600' },
          formatter: v => v > 0 ? v : ''
        }
      },
      scales: {
        x: {
          ticks: { autoSkip: false, maxRotation: 35, font: { size: 11 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });
}

function renderStatus(data) {
  const statusMap = {};
  data.forEach(r => {
    const n = normalizeStatus(r['STATUS']);
    statusMap[n] = (statusMap[n] || 0) + 1;
  });
  const labels = Object.keys(statusMap);
  const values = labels.map(k => statusMap[k]);
  const total = values.reduce((a, b) => a + b, 0);

  document.getElementById('legend-status').innerHTML = labels.map((l, i) =>
    `<span class="legend-item"><span class="legend-dot" style="background:${STATUS_COLORS[i % STATUS_COLORS.length]};"></span>${l} (${values[i]})</span>`
  ).join('');

  if (charts.status) charts.status.destroy();
  charts.status = new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: STATUS_COLORS,
        borderWidth: 2,
        borderColor: '#fff',
        datalabels: { display: false }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw / total * 100)}%)`
          }
        }
      }
    }
  });
}

function renderTech(data) {
  const techMap = {};
  data.filter(r => normalizeStatus(r['STATUS']) === 'Complete' && (r['TEKNISI'] || '').trim())
    .forEach(r => {
      const t = r['TEKNISI'].trim();
      techMap[t] = (techMap[t] || 0) + 1;
    });

  const entries = Object.entries(techMap).sort((a, b) => b[1] - a[1]);
  const tLabels = entries.map(e => e[0]);
  const tData = entries.map(e => e[1]);

  const minH = Math.max(200, tLabels.length * 38 + 60);
  document.getElementById('tech-chart-wrap').style.height = minH + 'px';

  if (charts.tech) charts.tech.destroy();
  if (tLabels.length === 0) {
    document.getElementById('tech-chart-wrap').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:#888">Tidak ada data teknisi</div>';
    return;
  }
  charts.tech = new Chart(document.getElementById('chart-tech'), {
    type: 'bar',
    data: {
      labels: tLabels,
      datasets: [{
        label: 'Complete',
        data: tData,
        backgroundColor: '#185FA5',
        borderRadius: 4,
        barPercentage: 0.6,
        datalabels: { display: false }
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.06)' }
        },
        y: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

/* ── Table ── */
function renderTable() {
  const filtered = getFiltered();
  const search = (document.getElementById('search-input').value || '').toLowerCase();
  const searched = search ? filtered.filter(r =>
    [r['NO ORDER'], r['STATUS'], r['PAKET'], r['BULAN'], r['TEKNISI'], r['UPDATE']].join(' ').toLowerCase().includes(search)
  ) : filtered;

  const show = searched.slice(0, 150);
  const tbody = document.getElementById('table-body');
  if (show.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="td-center">Tidak ada data</td></tr>';
    document.getElementById('table-count').textContent = '';
    return;
  }

  tbody.innerHTML = show.map(r => `
    <tr>
      <td>${r['TGL'] || '-'}</td>
      <td title="${r['PAKET'] || ''}">${r['PAKET'] || '-'}</td>
      <td class="mono">${r['NO ORDER'] || '-'}</td>
      <td>${r['BULAN'] ? (r['BULAN'].charAt(0) + r['BULAN'].slice(1).toLowerCase()) : '-'}</td>
      <td>${r['TEKNISI'] || '-'}</td>
      <td>${statusBadge(r['STATUS'])}</td>
      <td title="${r['UPDATE'] || ''}" style="color:#5F5E5A;">${r['UPDATE'] || '-'}</td>
    </tr>
  `).join('');

  const count = document.getElementById('table-count');
  count.textContent = `Menampilkan ${show.length} dari ${searched.length} order` +
    (searched.length < filtered.length ? ` · filter aktif: ${filtered.length} data` : '');
}

function populateFilters() {
  const years = [...new Set(allData.map(r => getYear(r['TGL'])).filter(Boolean))].sort((a,b) => b - a);
  const ySel = document.getElementById('filter-year');
  const prevYear = ySel.value;
  ySel.innerHTML = '<option value="">Semua</option>';
  years.forEach(y => {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    ySel.appendChild(o);
  });
  if (prevYear) ySel.value = prevYear;

  updateDependentFilters();
}

function updateDependentFilters() {
  const year  = document.getElementById('filter-year').value;
  const month = document.getElementById('filter-month').value;

  const filtered = allData.filter(r => {
    if (year  && getYear(r['TGL']) !== year) return false;
    if (month && r['BULAN'] !== month) return false;
    return true;
  });

  const months = [...new Set(allData.filter(r => !year || getYear(r['TGL']) === year).map(r => r['BULAN']).filter(Boolean))];
  months.sort((a, b) => MONTHS_ORDER.indexOf(a.toUpperCase()) - MONTHS_ORDER.indexOf(b.toUpperCase()));
  const mSel = document.getElementById('filter-month');
  const prevMonth = mSel.value;
  mSel.innerHTML = '<option value="">Semua</option>';
  months.forEach(m => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = m.charAt(0) + m.slice(1).toLowerCase();
    mSel.appendChild(o);
  });
  if (months.includes(prevMonth)) mSel.value = prevMonth;

  const dates = [...new Set(filtered.map(r => (r['TGL'] || '').trim()).filter(Boolean))].sort((a, b) => {
    const pa = a.split('/'), pb = b.split('/');
    return new Date(pb[2], pb[1]-1, pb[0]) - new Date(pa[2], pa[1]-1, pa[0]);
  });
  const dSel = document.getElementById('filter-date');
  const prevDate = dSel.value;
  const todayStr = getTodayString();
  dSel.innerHTML = '<option value="">Semua</option>';
  dates.forEach(d => {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = d === todayStr ? `${d} (Hari Ini)` : d;
    dSel.appendChild(o);
  });
  if (dates.includes(prevDate)) dSel.value = prevDate;

  const techs = [...new Set(filtered.map(r => r['TEKNISI']).filter(Boolean))].sort();
  const tSel = document.getElementById('filter-tech');
  const prevTech = tSel.value;
  tSel.innerHTML = '<option value="">Semua</option>';
  techs.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    tSel.appendChild(o);
  });
  if (techs.includes(prevTech)) tSel.value = prevTech;
}

/* ── Load Data ── */
async function loadData() {
  document.getElementById('last-update').textContent = 'Memuat data...';
  document.getElementById('table-body').innerHTML = '<tr><td colspan="7" class="td-center">Menarik data dari Google Sheets...</td></tr>';
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    allData = parseCSV(text);
    const now = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('last-update').textContent = `Diperbarui: ${now} · ${allData.length} baris`;
    populateFilters();
    applyFilter();
    renderToday();
    startCountdown();
  } catch (e) {
    document.getElementById('last-update').textContent = 'Gagal memuat data';
    document.getElementById('table-body').innerHTML =
      `<tr><td colspan="7" class="td-center" style="color:#A32D2D;">Gagal terhubung ke Google Sheets.<br><small>${e.message}</small></td></tr>`;
  }
}

loadData();

// Auto-refresh setiap 1 menit
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

setInterval(() => {
  loadData();
}, 300000);

startCountdown();
