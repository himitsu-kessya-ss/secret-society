import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

fetch('/secret-society/header.html')
  .then(res => res.ok ? res.text() : '')
  .then(html => {
    if (!html) return;
    const container = document.getElementById('common-header');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    container.innerHTML = '';
    Array.from(parsed.head.childNodes).forEach(node => container.appendChild(node.cloneNode(true)));
    Array.from(parsed.body.childNodes).forEach(node => {
      if (node.tagName === 'SCRIPT') {
        const s = document.createElement('script');
        s.textContent = node.textContent;
        container.appendChild(s);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });
    container.querySelectorAll('.nav-item-custom').forEach(a => {
      if (a.getAttribute('href') === '/secret-society/boss/') a.classList.add('active');
    });
  })
  .catch(() => {});

const firebaseConfig = {
  apiKey: "AIzaSyAKnEENO4tuGtFHsTOAWusbUNPzzUiMNMY",
  authDomain: "himitsukessya-aa509.firebaseapp.com",
  projectId: "himitsukessya-aa509",
  storageBucket: "himitsukessya-aa509.appspot.com",
  messagingSenderId: "584936417780",
  appId: "1:584936417780:web:7702b98ea7faf7ccfbb1a1",
  measurementId: "G-9XBXVQN1JC"
};

const ADMIN_PASS = "p@ssw0rd";
const COLLECTION_NAME = "boss_comps";
const LIKED_STORAGE_KEY = "mst_boss_liked_keys";
const CSV_FILE_PATH = "./boss_list.csv";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let bossList = [];
let compMap = (typeof BOSS_BEST_COMP_DATA !== 'undefined') ? { ...BOSS_BEST_COMP_DATA } : {};
let likedKeys = JSON.parse(localStorage.getItem(LIKED_STORAGE_KEY)) || [];
let currentBossId = null;
let editingCompKey = null;

// キー: "各ボス名(搭乗者名)_投稿No."
const buildCompKey = (bossName, pilot, postNo) => `${bossName.trim()}(${pilot.trim()})_${postNo}`;

onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
  const nextMap = {};
  snapshot.forEach(d => { nextMap[d.id] = d.data(); });
  compMap = nextMap;

  if (!document.getElementById('view-list').classList.contains('hidden')) renderBossGrid();
  if (!document.getElementById('view-detail').classList.contains('hidden') && currentBossId !== null) {
    const boss = bossList.find(b => b.id === currentBossId);
    if (boss && !editingCompKey) updateNextPostNo(boss);
    renderCompList();
  }
});

document.getElementById('tab-list').addEventListener('click', () => switchTab('list'));
document.getElementById('tab-master').addEventListener('click', () => switchTab('master'));
document.getElementById('back-to-list-btn').addEventListener('click', () => {
  cancelEditMode();
  switchTab('list');
});
document.getElementById('comp-form').addEventListener('submit', submitComp);
document.getElementById('cancel-edit-btn').addEventListener('click', () => {
  cancelEditMode();
  const boss = bossList.find(b => b.id === currentBossId);
  if (boss) updateNextPostNo(boss);
});
document.getElementById('filter-terrain').addEventListener('change', renderCompList);
document.getElementById('filter-weight').addEventListener('change', renderCompList);
document.getElementById('sort-select').addEventListener('change', renderCompList);
document.getElementById('export-comp-btn').addEventListener('click', exportCompDataJS);

initBossCsv();

async function initBossCsv() {
  try {
    const res = await fetch(CSV_FILE_PATH, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csvText = await res.text();
    const rows = parseCsvText(csvText);

    bossList = rows
      .filter(r => r && r.length >= 2 && /^\d+$/.test((r[0] || '').trim()) && (r[1] || '').trim())
      .map(r => {
        const id = Number(r[0].trim());
        return {
          id,
          name: r[1].trim(),
          pilot: (r[2] || '').trim(),
          nt: (r[3] || '').trim(),
          weapon: (r[4] || '').trim(),
          rangeMin: Number((r[5] || '0').trim()) || 0,
          rangeMax: Number((r[6] || '0').trim()) || 0,
          attribute: (r[7] || '').trim(),
          cut: (r[8] || '').trim(),
          effect: (r[9] || '').trim(),
          image: `images/boss_${String(id).padStart(2, '0')}.png`
        };
      });

    renderBossGrid();
    renderMasterTable();
  } catch (err) {
    console.error('boss_list.csv 読み込みエラー:', err);
    document.getElementById('boss-grid').innerHTML =
      `<p class="loading-text">boss_list.csv の読み込みに失敗しました。</p>`;
    document.getElementById('master-tbody').innerHTML =
      `<tr><td colspan="10">boss_list.csv の読み込みに失敗しました。</td></tr>`;
  }
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\r' && next === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
      else if (ch === '\n' || ch === '\r') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else { cell += ch; }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function switchTab(tabName) {
  ['list', 'detail', 'master'].forEach(v => document.getElementById(`view-${v}`).classList.add('hidden'));
  ['list', 'master'].forEach(t => document.getElementById(`tab-${t}`).classList.remove('active'));

  document.getElementById(`view-${tabName}`).classList.remove('hidden');
  document.getElementById(`tab-${tabName === 'detail' ? 'list' : tabName}`).classList.add('active');
  if (tabName === 'list') renderBossGrid();
  if (tabName === 'master') renderMasterTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getAttrBadge(attr) {
  const cls = attr === 'ビーム' ? 'attr-beam' : attr === '実弾' ? 'attr-solid' : attr === 'ヒート' ? 'attr-heat' : '';
  return cls ? `<span class="badge-attr ${cls}">${escapeHtml(attr)}</span>` : escapeHtml(attr || '-');
}

function handleImgError(img, name) {
  img.onerror = null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="200" height="140" fill="#121521"/><text x="50%" y="48%" fill="#9aa3b8" font-size="12" text-anchor="middle">NO IMAGE</text><text x="50%" y="65%" fill="#f5b041" font-size="11" text-anchor="middle">${escapeHtml(name)}</text></svg>`;
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function renderBossGrid() {
  const grid = document.getElementById('boss-grid');
  grid.innerHTML = '';

  bossList.forEach(boss => {
    const prefix = `${boss.name}(${boss.pilot})_`;
    const count = Object.entries(compMap).filter(([k, c]) => c.bossId === boss.id || k.startsWith(prefix)).length;

    const card = document.createElement('div');
    card.className = 'boss-card';
    card.addEventListener('click', () => openBossDetail(boss.id));
    card.innerHTML = `
      <div class="boss-img-wrap">
        <span class="boss-no-badge">#${boss.id}</span>
        <img src="${escapeHtml(boss.image)}" alt="${escapeHtml(boss.name)}">
        <span class="post-count-badge">編成 ${count}件</span>
      </div>
      <div class="boss-card-body">
        <div>
          <div class="boss-card-title">${escapeHtml(boss.name)}</div>
          <div class="boss-card-pilot">搭乗者：${escapeHtml(boss.pilot)}</div>
        </div>
        <div class="boss-card-sub">${escapeHtml(boss.weapon)}（射程 ${boss.rangeMin}-${boss.rangeMax}）</div>
      </div>`;
    const img = card.querySelector('img');
    img.addEventListener('error', () => handleImgError(img, boss.name));
    grid.appendChild(card);
  });
}

function openBossDetail(bossId) {
  cancelEditMode();
  currentBossId = bossId;
  const boss = bossList.find(b => b.id === bossId);
  if (!boss) return;

  const detailDiv = document.getElementById('boss-detail-content');
  detailDiv.innerHTML = `
    <div class="boss-hero-banner">
      <div class="boss-hero-img"><img src="${escapeHtml(boss.image)}" alt="${escapeHtml(boss.name)}"></div>
      <div class="boss-hero-info">
        <span class="raid-alert">WARNING // RAID BOSS #${boss.id}</span>
        <h2>${escapeHtml(boss.name)}</h2>
        <div class="boss-hero-pilot">パイロット：${escapeHtml(boss.pilot)} ${boss.nt ? `（${escapeHtml(boss.nt)}）` : ''}</div>
        <table class="spec-table">
          <tr><th>使用武器</th><td><strong>${escapeHtml(boss.weapon)}</strong></td><th>属性</th><td>${getAttrBadge(boss.attribute)}</td></tr>
          <tr><th>射程</th><td>${boss.rangeMin} ～ ${boss.rangeMax}</td><th>切払</th><td>${escapeHtml(boss.cut || 'なし')}</td></tr>
          <tr><th>特殊効果</th><td colspan="3" class="effect-text">${escapeHtml(boss.effect || '特になし')}</td></tr>
        </table>
      </div>
    </div>`;
  const heroImg = detailDiv.querySelector('.boss-hero-img img');
  heroImg.addEventListener('error', () => handleImgError(heroImg, boss.name));

  document.getElementById('filter-terrain').value = '';
  document.getElementById('filter-weight').value = '';
  updateNextPostNo(boss);
  renderCompList();
  switchTab('detail');
}

function updateNextPostNo(boss) {
  const prefix = `${boss.name}(${boss.pilot})_`;
  let maxNo = 0;
  Object.entries(compMap).forEach(([k, v]) => {
    if (k.startsWith(prefix) || (v.bossName === boss.name && v.pilot === boss.pilot)) {
      maxNo = Math.max(maxNo, Number(v.postNo) || 0);
    }
  });
  document.getElementById('f-postNo').value = maxNo + 1;
}

function startEditComp(key) {
  const target = compMap[key];
  if (!target) return;

  const pw = prompt('編集するには投稿時の4桁パスワード（または管理者PW）を入力してください：');
  if (pw === null) return;

  if (pw !== target.password && pw !== ADMIN_PASS) {
    alert('パスワードが一致しません。');
    return;
  }

  editingCompKey = key;
  document.getElementById('comp-form-panel').classList.add('editing-mode');
  document.getElementById('form-panel-title').textContent = `✏️ 攻略編成を編集する（No.${target.postNo}）`;
  document.getElementById('submit-comp-btn').textContent = '編成を更新する';
  document.getElementById('cancel-edit-btn').classList.remove('hidden');

  setCheckboxValues('terrainCond', target.terrains || []);
  setCheckboxValues('weightCond', target.weights || []);
  setCheckboxValues('hpCond', target.hpConditions || []);

  document.getElementById('f-unitName').value = target.unitName || '';
  document.getElementById('f-unitCustom').value = target.unitCustom || '';
  document.getElementById('f-weapon').value = target.weapon || '';
  document.getElementById('f-equipment').value = target.equipment || '';
  document.getElementById('f-trait').value = target.trait || '';
  document.getElementById('f-postNo').value = target.postNo || '';
  document.getElementById('f-author').value = target.author || '';
  document.getElementById('f-password').value = target.password || '';
  document.getElementById('f-comment').value = target.comment || '';

  document.getElementById('comp-form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEditMode() {
  editingCompKey = null;
  document.getElementById('comp-form-panel').classList.remove('editing-mode');
  document.getElementById('form-panel-title').textContent = '📝 攻略編成を投稿する';
  document.getElementById('submit-comp-btn').textContent = '編成を投稿する';
  document.getElementById('cancel-edit-btn').classList.add('hidden');
  document.getElementById('comp-form').reset();
}

function setCheckboxValues(name, values) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
    cb.checked = values.includes(cb.value);
  });
}

async function submitComp(e) {
  e.preventDefault();
  const boss = bossList.find(b => b.id === currentBossId);
  if (!boss) return;

  const checkedTerrains = Array.from(document.querySelectorAll('input[name="terrainCond"]:checked')).map(cb => cb.value);
  const checkedWeights = Array.from(document.querySelectorAll('input[name="weightCond"]:checked')).map(cb => cb.value);
  const checkedHps = Array.from(document.querySelectorAll('input[name="hpCond"]:checked')).map(cb => cb.value);
  if (checkedHps.length === 0) return alert('「ボス残りHP割合」を1つ以上チェックしてください。');

  const btn = document.getElementById('submit-comp-btn');
  btn.disabled = true;
  btn.textContent = editingCompKey ? '更新中...' : '送信中...';

  try {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const payload = {
      terrains: checkedTerrains,
      weights: checkedWeights,
      hpConditions: checkedHps,
      unitName: document.getElementById('f-unitName').value.trim(),
      unitCustom: document.getElementById('f-unitCustom').value.trim(),
      weapon: document.getElementById('f-weapon').value.trim(),
      equipment: document.getElementById('f-equipment').value.trim(),
      trait: document.getElementById('f-trait').value.trim(),
      author: document.getElementById('f-author').value.trim(),
      comment: document.getElementById('f-comment').value.trim(),
      password: document.getElementById('f-password').value.trim(),
      updatedAt: nowStr
    };

    if (editingCompKey) {
      await updateDoc(doc(db, COLLECTION_NAME, editingCompKey), payload);
      cancelEditMode();
      updateNextPostNo(boss);
      alert('攻略編成を更新しました！');
    } else {
      const postNo = Number(document.getElementById('f-postNo').value);
      const uniqueKey = buildCompKey(boss.name, boss.pilot, postNo);
      if (compMap[uniqueKey]) return alert('投稿No.が重複しています。');

      await setDoc(doc(db, COLLECTION_NAME, uniqueKey), {
        bossId: boss.id,
        bossName: boss.name,
        pilot: boss.pilot,
        postNo,
        ...payload,
        timestamp: nowStr,
        likes: 0,
        createdAt: serverTimestamp()
      });

      document.getElementById('comp-form').reset();
      updateNextPostNo(boss);
      alert('攻略編成を投稿しました！');
    }
  } catch (err) {
    console.error(err);
    alert(editingCompKey ? '更新に失敗しました。' : '投稿に失敗しました。');
  } finally {
    btn.disabled = false;
    btn.textContent = editingCompKey ? '編成を更新する' : '編成を投稿する';
  }
}

function renderCompList() {
  const listDiv = document.getElementById('comp-list');
  const selectedTerrain = document.getElementById('filter-terrain').value;
  const selectedWeight = document.getElementById('filter-weight').value;
  const sortType = document.getElementById('sort-select').value;
  const boss = bossList.find(b => b.id === currentBossId);
  if (!boss) return;

  const prefix = `${boss.name}(${boss.pilot})_`;
  let items = Object.entries(compMap)
    .filter(([k, v]) => k.startsWith(prefix) || v.bossId === currentBossId)
    .map(([key, val]) => ({ key, ...val }));

  if (selectedTerrain) {
    items = items.filter(item => Array.isArray(item.terrains) && item.terrains.includes(selectedTerrain));
  }
  if (selectedWeight) {
    items = items.filter(item => Array.isArray(item.weights) && item.weights.includes(selectedWeight));
  }

  items.sort((a, b) => {
    if (sortType === 'likes') return (b.likes || 0) - (a.likes || 0) || (b.postNo || 0) - (a.postNo || 0);
    if (sortType === 'newest') return (b.postNo || 0) - (a.postNo || 0);
    return (a.postNo || 0) - (b.postNo || 0);
  });

  if (items.length === 0) {
    listDiv.innerHTML = `<p class="loading-text">条件に一致する攻略編成がありません。</p>`;
    return;
  }

  listDiv.innerHTML = items.map(item => {
    const isLiked = likedKeys.includes(item.key);
    const terrainBadges = (item.terrains || []).map(t => `<span class="terrain-tag">${escapeHtml(t)}</span>`).join('');
    const weightBadges = (item.weights || []).map(w => `<span class="weight-tag">${escapeHtml(w)}</span>`).join('');
    const hpBadges = (item.hpConditions || []).map(hp => `<span class="hp-tag">${escapeHtml(hp)}</span>`).join('');
    const timeLabel = item.updatedAt
      ? `${escapeHtml(item.timestamp || '')}（更新: ${escapeHtml(item.updatedAt)}）`
      : escapeHtml(item.timestamp || '');

    return `
      <div class="comp-card">
        <div class="comp-top">
          <div class="comp-meta"><span class="comp-no">No.${item.postNo}</span> ｜ 投稿者：<strong>${escapeHtml(item.author)}</strong></div>
          <div class="comp-meta">${timeLabel}</div>
        </div>
        <div class="tag-rows">
          ${terrainBadges ? `<div class="hp-tags"><span class="tag-label">地形:</span>${terrainBadges}</div>` : ''}
          ${weightBadges ? `<div class="hp-tags"><span class="tag-label">重量:</span>${weightBadges}</div>` : ''}
          <div class="hp-tags"><span class="tag-label">残りHP:</span>${hpBadges}</div>
        </div>
        <div class="comp-specs">
          <div><span>機体名</span><strong>${escapeHtml(item.unitName)}</strong></div>
          <div><span>機体カスタム</span>${escapeHtml(item.unitCustom || '-')}</div>
          <div><span>武器</span><strong>${escapeHtml(item.weapon)}</strong></div>
          <div><span>装備</span>${escapeHtml(item.equipment)}</div>
          <div><span>特性</span>${escapeHtml(item.trait || '-')}</div>
        </div>
        ${item.comment ? `<div class="comp-comment">${escapeHtml(item.comment)}</div>` : ''}
        <div class="comp-actions">
          <button type="button" class="like-btn ${isLiked ? 'liked' : ''}" data-key="${escapeHtml(item.key)}">
            <span class="heart-icon">${isLiked ? '❤' : '♡'}</span><span>いいね！</span><strong>${item.likes || 0}</strong>
          </button>
          <div class="comp-manage-btns">
            <button type="button" class="edit-btn" data-key="${escapeHtml(item.key)}">編集</button>
            <button type="button" class="del-btn" data-key="${escapeHtml(item.key)}">削除</button>
          </div>
        </div>
      </div>`;
  }).join('');

  listDiv.querySelectorAll('.like-btn').forEach(b => b.addEventListener('click', () => toggleLike(b.dataset.key)));
  listDiv.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => startEditComp(b.dataset.key)));
  listDiv.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', () => deleteComp(b.dataset.key)));
}

async function toggleLike(key) {
  if (!compMap[key]) return;
  const idx = likedKeys.indexOf(key);
  const isLiked = idx !== -1;

  try {
    await updateDoc(doc(db, COLLECTION_NAME, key), { likes: increment(isLiked ? -1 : 1) });
    if (isLiked) likedKeys.splice(idx, 1);
    else likedKeys.push(key);
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedKeys));
  } catch (err) {
    console.error(err);
  }
}

async function deleteComp(key) {
  const target = compMap[key];
  if (!target) return;
  const pw = prompt('削除するには投稿時の4桁パスワード（または管理者PW）を入力してください：');
  if (pw === null) return;

  if (pw === target.password || pw === ADMIN_PASS) {
    if (editingCompKey === key) cancelEditMode();
    await deleteDoc(doc(db, COLLECTION_NAME, key));
    alert('投稿を削除しました。');
  } else {
    alert('パスワードが一致しません。');
  }
}

function exportCompDataJS() {
  const exportObj = {};
  Object.entries(compMap).forEach(([k, v]) => {
    const { createdAt, ...rest } = v;
    exportObj[k] = rest;
  });
  const content = `// boss/boss_best_comp_data.js\nconst BOSS_BEST_COMP_DATA = ${JSON.stringify(exportObj, null, 2)};\n`;
  const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'boss_best_comp_data.js';
  a.click();
}

function renderMasterTable() {
  const tbody = document.getElementById('master-tbody');
  tbody.innerHTML = bossList.map(b => `
    <tr>
      <td>${b.id}</td><td><strong>${escapeHtml(b.name)}</strong></td><td>${escapeHtml(b.pilot)}</td>
      <td>${escapeHtml(b.nt)}</td><td>${escapeHtml(b.weapon)}</td><td>${b.rangeMin}</td>
      <td>${b.rangeMax}</td><td>${getAttrBadge(b.attribute)}</td><td>${escapeHtml(b.cut)}</td>
      <td>${escapeHtml(b.effect)}</td>
    </tr>`).join('');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
