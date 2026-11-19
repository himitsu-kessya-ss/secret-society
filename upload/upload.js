import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 各種モジュールのインポート
import { handlePostSubmit, handlePostDelete, handlePostUpdate } from "./upload_post-handler.js";
import { MASTER_ABILITIES } from "./ability-master.js";
import { analyzeImageAbilities } from "./upload_ocr-processor.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById('upload-form');
const submitBtn = document.getElementById('submit-btn');
const postList = document.getElementById('post-list');
const loadingMsg = document.getElementById('loading-msg');
const searchInput = document.getElementById('search-input');
const tableSearchInput = document.getElementById('table-search-input');
const tableBody = document.getElementById('registered-table-body');
const imageFileInput = document.getElementById('image-file');

// 入力保持用のストレージキー
const STORAGE_KEY_AUTHOR = 'ss_upload_author';
const STORAGE_KEY_DELETE_KEY = 'ss_upload_delete_key';

let allPosts = [];
let displayLimit = 10;

// --- 機体名(キー)と機体No.(バリュー)の対応マップ ＆ CSV全データ ---
let machineDataMap = new Map();
let allCsvMachines = []; // { no, name } の配列
let currentThousandMin = 0; // 現在選択中の千番台の最小値（例: 0, 1000, 2000...）

// --- ソート状態管理 ---
let currentSortColumn = 'unitNo';
let currentSortDirection = 'asc';

// --- 機体No.を必ず4桁ゼロ埋めに正規化するヘルパー関数 ---
function formatUnitNo(noStr) {
    if (!noStr && noStr !== 0) return '';
    const trimmed = String(noStr).trim();
    if (/^\d+$/.test(trimmed)) {
        return trimmed.padStart(4, '0');
    }
    return trimmed;
}

// --- 初期化：CSVデータの読み込み（routeフォルダ内） ---
async function loadMachineCsvForJs() {
    try {
        const response = await fetch('../route/GL)機体一覧 - 機体一覧.csv');
        if (!response.ok) throw new Error('CSVファイルの取得に失敗しました。');
        const csvText = await response.text();
        
        const lines = csvText.split(/\r\n|\n/);
        allCsvMachines = [];
        machineDataMap.clear();

        lines.forEach(line => {
            if (!line.trim()) return;
            const cols = line.split(',');
            if (cols.length >= 2) {
                const rawNo = cols[0].trim();      // 1列目：機体No.
                const machineName = cols[1].trim();// 2列目：機体名
                if (rawNo && machineName) {
                    const formattedNo = formatUnitNo(rawNo);
                    machineDataMap.set(machineName, formattedNo);
                    allCsvMachines.push({ no: formattedNo, name: machineName });
                }
            }
        });
    } catch (error) {
        console.error('機体一覧CSV読み込みエラー:', error);
    }
}

// --- 初期化：No.1 〜 No.11 セレクトボックスの生成 ---
function createAbilityOptionsHTML(selectedValue = '') {
    let html = '<option value="">-- 未選択 --</option>';
    MASTER_ABILITIES.forEach(ability => {
        const selected = ability === selectedValue ? 'selected' : '';
        html += `<option value="${escapeHTML(ability)}" ${selected}>${escapeHTML(ability)}</option>`;
    });
    return html;
}

function updateSelectBackground(selectEl) {
    if (selectEl.value) {
        selectEl.style.backgroundColor = '#3a2711';
        selectEl.style.borderColor = '#d97706';
        selectEl.style.color = '#ffedd5';
    } else {
        selectEl.style.backgroundColor = '#1a1c1e';
        selectEl.style.borderColor = '#555';
        selectEl.style.color = '#fff';
    }
}

function initAbilityDropdowns() {
    for (let i = 1; i <= 11; i++) {
        const selectEl = document.getElementById(`ability-${i}`);
        if (!selectEl) continue;
        selectEl.innerHTML = createAbilityOptionsHTML();
        updateSelectBackground(selectEl);
        
        selectEl.addEventListener('change', () => {
            updateSelectBackground(selectEl);
        });
    }
}

function loadSavedCredentials() {
    const savedAuthor = localStorage.getItem(STORAGE_KEY_AUTHOR);
    const savedDeleteKey = localStorage.getItem(STORAGE_KEY_DELETE_KEY);

    if (savedAuthor) {
        document.getElementById('author').value = savedAuthor;
    }
    if (savedDeleteKey) {
        document.getElementById('delete-key').value = savedDeleteKey;
    }
}

// 投稿一覧データの読み込み＆ランキング・進捗集計
async function loadPosts() {
    try {
        postList.innerHTML = '';
        loadingMsg.style.display = 'block';

        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        loadingMsg.style.display = 'none';

        allPosts = [];
        querySnapshot.forEach((docSnap) => {
            allPosts.push({ id: docSnap.id, ...docSnap.data() });
        });

        const countSpan = document.getElementById('total-unit-count');
        if (countSpan) {
            countSpan.textContent = allPosts.length;
        }

        displayLimit = 10;
        renderPosts(allPosts);
        applySortAndRenderTable();
        renderRanking(allPosts);
        renderProgressStats(allPosts);

    } catch (error) {
        console.error("読み込みエラー:", error);
        loadingMsg.textContent = 'データの読み込みに失敗しました。画面を再読み込みしてください。';
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger-color);">データの読み込みに失敗しました。</td></tr>';
    }
}

// --- 登録進捗 ＆ マトリクス・パレット描画処理 ---
function renderProgressStats(posts) {
    const overallNumEl = document.getElementById('overall-progress-num');
    const overallRegEl = document.getElementById('overall-registered-count');
    const overallTotalEl = document.getElementById('overall-total-count');
    const overallBarEl = document.getElementById('overall-progress-bar');
    const rangeTableBody = document.getElementById('range-progress-table-body');

    if (!overallNumEl || !rangeTableBody) return;

    if (allCsvMachines.length === 0) {
        overallNumEl.textContent = '0.00%';
        rangeTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--sub-text);">CSV機体データが読み込まれていません。</td></tr>';
        return;
    }

    const registeredMap = new Map();
    posts.forEach(p => {
        if (p.unitNumber && p.unitNumber.trim() !== '----') {
            const formattedNo = formatUnitNo(p.unitNumber);
            registeredMap.set(formattedNo, p);
        }
    });

    const totalCsvCount = allCsvMachines.length;
    let registeredCsvCount = 0;

    allCsvMachines.forEach(m => {
        if (registeredMap.has(m.no)) {
            registeredCsvCount++;
        }
    });

    const overallPercentage = totalCsvCount > 0 ? ((registeredCsvCount / totalCsvCount) * 100).toFixed(2) : '0.00';

    overallNumEl.textContent = `${overallPercentage}%`;
    overallRegEl.textContent = registeredCsvCount;
    overallTotalEl.textContent = totalCsvCount;
    overallBarEl.style.width = `${Math.min(parseFloat(overallPercentage), 100)}%`;

    const ranges = [
        { label: '0000 ～ 0999', min: 0, max: 999 },
        { label: '1000 ～ 1999', min: 1000, max: 1999 },
        { label: '2000 ～ 2999', min: 2000, max: 2999 },
        { label: '3000 ～ 3999', min: 3000, max: 3999 },
        { label: '4000 ～ 4999', min: 4000, max: 4999 },
        { label: '5000 ～ 5999', min: 5000, max: 5999 },
        { label: '6000 ～ 6999', min: 6000, max: 6999 },
        { label: '7000 ～ 7999', min: 7000, max: 7999 },
        { label: '8000 ～ 8999', min: 8000, max: 8999 },
        { label: '9000番台以降', min: 9000, max: 999999 }
    ];

    rangeTableBody.innerHTML = '';

    ranges.forEach(range => {
        const rangeMachines = allCsvMachines.filter(m => {
            const num = parseInt(m.no, 10);
            return !isNaN(num) && num >= range.min && num <= range.max;
        });

        if (rangeMachines.length === 0) return;

        let rangeTotal = rangeMachines.length;
        let rangeReg = 0;

        rangeMachines.forEach(m => {
            if (registeredMap.has(m.no)) rangeReg++;
        });

        const rangePercentage = rangeTotal > 0 ? ((rangeReg / rangeTotal) * 100).toFixed(2) : '0.00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${range.label}</strong></td>
            <td style="text-align: right; color: var(--accent-color); font-weight: bold;">${rangeReg} / ${rangeTotal} 件</td>
            <td style="text-align: right; font-weight: bold; color: #fff;">${rangePercentage}%</td>
            <td>
                <div class="progress-bar-container-small">
                    <div class="progress-bar-fill-small" style="width: ${Math.min(parseFloat(rangePercentage), 100)}%;"></div>
                </div>
            </td>
        `;
        rangeTableBody.appendChild(tr);
    });

    renderThousandButtons(ranges, registeredMap);
    renderMatrixPalette(currentThousandMin, registeredMap);
}

function renderThousandButtons(ranges, registeredMap) {
    const btnContainer = document.getElementById('thousand-tab-buttons');
    if (!btnContainer) return;
    btnContainer.innerHTML = '';

    ranges.forEach(range => {
        const hasMachines = allCsvMachines.some(m => {
            const num = parseInt(m.no, 10);
            return !isNaN(num) && num >= range.min && num <= range.max;
        });
        if (!hasMachines) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `thousand-btn ${range.min === currentThousandMin ? 'active' : ''}`;
        btn.textContent = range.min === 0 ? '0番台' : `${range.min}番台`;
        
        btn.addEventListener('click', () => {
            currentThousandMin = range.min;
            document.querySelectorAll('.thousand-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMatrixPalette(currentThousandMin, registeredMap);
        });

        btnContainer.appendChild(btn);
    });
}

function renderMatrixPalette(minVal, registeredMap) {
    const gridContainer = document.getElementById('matrix-grid-container');
    const rangeTitle = document.getElementById('matrix-range-title');
    const detailCard = document.getElementById('matrix-detail-card');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';
    if (detailCard) detailCard.style.display = 'none';

    const maxVal = minVal + 999;
    rangeTitle.textContent = `${formatUnitNo(minVal)} ～ ${formatUnitNo(maxVal)} 番台のパレット`;

    const rangeMachineMap = new Map();
    allCsvMachines.forEach(m => {
        const num = parseInt(m.no, 10);
        if (!isNaN(num) && num >= minVal && num <= maxVal) {
            rangeMachineMap.set(m.no, m);
        }
    });

    if (rangeMachineMap.size === 0) {
        gridContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--sub-text); padding: 20px;">この番号帯には機体データがありません。</div>';
        return;
    }

    let minNo = minVal;
    let maxNo = Math.min(minVal + 999, Math.max(...Array.from(rangeMachineMap.keys()).map(Number)));

    for (let i = minNo; i <= maxNo; i++) {
        const paddedNo = formatUnitNo(i);
        const cell = document.createElement('div');
        cell.className = 'matrix-cell';
        cell.textContent = paddedNo;

        const csvData = rangeMachineMap.get(paddedNo);
        const isRegistered = registeredMap.has(paddedNo);

        if (csvData) {
            if (isRegistered) {
                cell.classList.add('registered');
                cell.title = `[登録済] No.${paddedNo} ${csvData.name}`;
            } else {
                cell.title = `[未登録] No.${paddedNo} ${csvData.name}`;
            }

            cell.addEventListener('click', () => {
                showMatrixDetail(paddedNo, csvData, registeredMap.get(paddedNo));
            });
        } else {
            cell.style.opacity = '0.3';
            cell.style.cursor = 'default';
        }

        gridContainer.appendChild(cell);
    }
}

function showMatrixDetail(no, csvData, postData) {
    const detailCard = document.getElementById('matrix-detail-card');
    const detailContent = document.getElementById('matrix-detail-content');
    if (!detailCard || !detailContent) return;

    detailCard.style.display = 'block';

    let abilitiesHTML = '-';
    if (postData && postData.abilities && Array.isArray(postData.abilities)) {
        abilitiesHTML = postData.abilities.map(a => `<span class="ability-badge"><span class="ability-num">No.${a.no}</span>${escapeHTML(a.text)}</span>`).join(' ');
    }

    if (postData) {
        detailContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
                <div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #fff; margin-bottom: 5px;">
                        <span class="unit-no-badge" style="margin-right: 8px;">No.${no}</span>${escapeHTML(csvData.name)}
                    </div>
                    <div style="color: #22c55e; font-weight: bold; margin-bottom: 8px;">✔ 登録済み（投稿者: ${escapeHTML(postData.author || '名無し')}）</div>
                    <div style="font-size: 0.85rem; color: var(--sub-text); margin-bottom: 8px;">特殊能力: ${abilitiesHTML}</div>
                </div>
                ${postData.imageUrl ? `<div><a href="${postData.imageUrl}" target="_blank" rel="noopener noreferrer" class="img-link-btn">🔗 投稿画像を見る</a></div>` : ''}
            </div>
        `;
    } else {
        detailContent.innerHTML = `
            <div>
                <div style="font-size: 1.1rem; font-weight: bold; color: #fff; margin-bottom: 5px;">
                    <span class="unit-no-badge" style="margin-right: 8px; border-color: #555; color: #aaa;">No.${no}</span>${escapeHTML(csvData.name)}
                </div>
                <div style="color: #ff4d4d; font-weight: bold;">⚠️ 未登録の機体です（まだ誰もSSを投稿していません）</div>
            </div>
        `;
    }
}

function renderRanking(posts) {
    const top3Container = document.getElementById('top3-ranking-container');
    const rankingTableBody = document.getElementById('ranking-table-body');
    if (!top3Container || !rankingTableBody) return;

    const authorCounts = {};
    posts.forEach(post => {
        const author = (post.author || '名無しパイロット').trim();
        authorCounts[author] = (authorCounts[author] || 0) + 1;
    });

    const sortedRanking = Object.keys(authorCounts).map(author => {
        return { author, count: authorCounts[author] };
    }).sort((a, b) => b.count - a.count);

    top3Container.innerHTML = '';
    rankingTableBody.innerHTML = '';

    if (sortedRanking.length === 0) {
        rankingTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--sub-text);">投稿データがまだありません。</td></tr>';
        return;
    }

    const crowns = ['👑', '🥈', '🥉'];
    const rankTitles = ['1st Place', '2nd Place', '3rd Place'];

    for (let i = 0; i < Math.min(3, sortedRanking.length); i++) {
        const item = sortedRanking[i];
        const rankNum = i + 1;
        const card = document.createElement('div');
        card.className = `top3-card rank-${rankNum}`;
        card.innerHTML = `
            <div class="crown-icon">${crowns[i]}</div>
            <div class="top3-rank-num">${rankTitles[i]}</div>
            <div class="top3-name">${escapeHTML(item.author)}</div>
            <div class="top3-count">${item.count}<span class="top3-count-unit">件</span></div>
        `;
        top3Container.appendChild(card);
    }

    sortedRanking.forEach((item, index) => {
        const rankNum = index + 1;
        let badgeClass = 'rank-badge';
        if (rankNum === 1) badgeClass += ' rank-1-badge';
        if (rankNum === 2) badgeClass += ' rank-2-badge';
        if (rankNum === 3) badgeClass += ' rank-3-badge';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;"><span class="${badgeClass}">${rankNum}</span></td>
            <td><strong>${escapeHTML(item.author)}</strong></td>
            <td style="text-align: right; color: var(--accent-color); font-weight: bold; font-size: 1.05rem;">${item.count} 件</td>
        `;
        rankingTableBody.appendChild(tr);
    });
}

function applySortAndRenderTable() {
    const keyword = tableSearchInput ? tableSearchInput.value.toLowerCase().trim() : '';

    let filtered = allPosts.filter(post => {
        const textToSearch = `${post.unitNumber || ''} ${post.unitName || ''} ${post.author || ''} ${post.postId || post.postNo || ''} ${(post.abilities || []).map(a => typeof a === 'string' ? a : a.text).join(' ')}`.toLowerCase();
        return textToSearch.includes(keyword);
    });

    filtered.sort((a, b) => {
        let valA, valB;

        switch (currentSortColumn) {
            case 'unitNo':
                valA = parseInt(a.unitNumber, 10) || 0;
                valB = parseInt(b.unitNumber, 10) || 0;
                break;
            case 'unitName':
                valA = a.unitName || '';
                valB = b.unitName || '';
                break;
            case 'abilities':
                valA = (a.abilities || []).map(item => item.text || item).join(', ');
                valB = (b.abilities || []).map(item => item.text || item).join(', ');
                break;
            case 'image':
                valA = a.imageUrl || '';
                valB = b.imageUrl || '';
                break;
            case 'postId':
                valA = parseInt(a.postId || a.postNo, 10) || 0;
                valB = parseInt(b.postId || b.postNo, 10) || 0;
                break;
            case 'author':
                valA = a.author || '';
                valB = b.author || '';
                break;
            default:
                valA = 0;
                valB = 0;
        }

        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderRegisteredTable(filtered);
    updateSortIcons();
}

function updateSortIcons() {
    document.querySelectorAll('#list-tab th[data-sort]').forEach(th => {
        const column = th.getAttribute('data-sort');
        const iconSpan = th.querySelector('.sort-icon');
        if (!iconSpan) return;

        if (column === currentSortColumn) {
            iconSpan.textContent = currentSortDirection === 'asc' ? ' 🔼' : ' 🔽';
            iconSpan.style.color = 'var(--accent-color, #00d4ff)';
        } else {
            iconSpan.textContent = '';
        }
    });
}

function renderRegisteredTable(posts) {
    tableBody.innerHTML = '';

    if (posts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--sub-text);">該当する機体データはありません。</td></tr>';
        return;
    }

    posts.forEach(data => {
        const tr = document.createElement('tr');
        const unitNo = escapeHTML(formatUnitNo(data.unitNumber) || '----');
        const unitName = escapeHTML(data.unitName || '名称未設定');
        const postIdStr = data.postId || data.postNo ? `No.${data.postId || data.postNo}` : '----';
        const authorStr = escapeHTML(data.author || '名無し');
        const imgUrl = data.imageUrl || '#';

        let abilityBadgesHTML = '';
        if (data.abilities && Array.isArray(data.abilities) && data.abilities.length > 0) {
            abilityBadgesHTML = data.abilities.map((item, idx) => {
                const no = item.no || (idx + 1);
                const text = typeof item === 'string' ? item : item.text;
                return `
                    <span class="ability-badge">
                        <span class="ability-num">No.${no}</span>
                        ${escapeHTML(text)}
                    </span>
                `;
            }).join('');
        } else {
            abilityBadgesHTML = '<span style="color:#666;">-</span>';
        }

        tr.innerHTML = `
            <td><span class="unit-no-badge">${unitNo}</span></td>
            <td><strong>${unitName}</strong></td>
            <td><div class="ability-container">${abilityBadgesHTML}</div></td>
            <td><a href="${imgUrl}" target="_blank" rel="noopener noreferrer" class="img-link-btn">🔗 画像を見る</a></td>
            <td><span style="color: #aaa; font-size: 13px;">${postIdStr}</span></td>
            <td><span style="color: #fff; font-size: 13px;">${authorStr}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#list-tab th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');

            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'asc';
            }

            applySortAndRenderTable();
        });
    });
});

imageFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'OCR解析中...';

        for (let i = 1; i <= 11; i++) {
            const selectEl = document.getElementById(`ability-${i}`);
            if (selectEl) {
                selectEl.value = '';
                updateSelectBackground(selectEl);
            }
        }

        const detectedAbilities = await analyzeImageAbilities(file);

        detectedAbilities.forEach(item => {
            const selectEl = document.getElementById(`ability-${item.no}`);
            if (selectEl) {
                selectEl.value = item.text;
                updateSelectBackground(selectEl);
            }
        });

    } catch (err) {
        console.error("OCR自動解析エラー:", err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '投稿する';
    }
});

// --- 編集エリア内の行選択状態＆集中上下ボタンの制御 ---
function refreshAbilityRowsState(container) {
    const rows = Array.from(container.querySelectorAll('.inline-ability-row'));
    const selectedLabel = container.querySelector('.ability-toolbar-selected');
    const upBtn = container.querySelector('.toolbar-up-btn');
    const downBtn = container.querySelector('.toolbar-down-btn');

    let selectedIndex = -1;

    rows.forEach((row, idx) => {
        const labelNum = row.querySelector('.ability-label-num');
        if (labelNum) {
            labelNum.textContent = `No.${idx + 1}`;
        }
        if (row.classList.contains('selected')) {
            selectedIndex = idx;
        }
    });

    if (selectedLabel) {
        if (selectedIndex >= 0) {
            const sel = rows[selectedIndex].querySelector('.inline-ability-select');
            const valText = sel && sel.value ? `（${sel.value}）` : '（未選択）';
            selectedLabel.textContent = `選択中: No.${selectedIndex + 1}${valText}`;
        } else {
            selectedLabel.textContent = '選択中: なし（行をクリックして選択）';
        }
    }

    if (upBtn) {
        upBtn.disabled = selectedIndex <= 0;
    }
    if (downBtn) {
        downBtn.disabled = selectedIndex < 0 || selectedIndex >= rows.length - 1;
    }
}

function selectAbilityRow(container, targetRow) {
    const rows = container.querySelectorAll('.inline-ability-row');
    rows.forEach(r => r.classList.remove('selected'));
    if (targetRow) {
        targetRow.classList.add('selected');
    }
    refreshAbilityRowsState(container);
}

function renderPosts(postsToRender) {
    postList.innerHTML = '';

    if (postsToRender.length === 0) {
        postList.innerHTML = '<p style="color: var(--sub-text); text-align: center; padding: 30px 0;">該当する投稿が見つかりませんでした。</p>';
        return;
    }

    const slicedPosts = postsToRender.slice(0, displayLimit);

    slicedPosts.forEach((data) => {
        const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('ja-JP') : '日時不明';
        const postNoStr = data.postNo || data.postId ? `投稿 No.${data.postNo || data.postId}` : '投稿 No.--';
        const unitNoStr = data.unitNumber ? `機体 No.${escapeHTML(formatUnitNo(data.unitNumber))}` : '機体 No.----';

        let abilityBadgesHTML = '';
        if (data.abilities && Array.isArray(data.abilities) && data.abilities.length > 0) {
            abilityBadgesHTML = data.abilities.map((item, idx) => {
                const no = item.no || (idx + 1);
                const text = typeof item === 'string' ? item : item.text;
                return `
                    <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 13px;">
                        <span style="background: #333; color: #ff9800; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 8px; font-weight: bold; min-width: 42px; text-align: center;">No.${no}</span>
                        <span style="color: #fff;">${escapeHTML(text)}</span>
                    </div>
                `;
            }).join('');
        } else {
            abilityBadgesHTML = '<div style="color: #666; font-size: 13px;">特殊能力の登録はありません</div>';
        }

        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div class="post-header">
                <div class="post-header-left">
                    <span class="post-author">${escapeHTML(data.author || '名無し')}</span>
                    <span class="post-date">${dateStr}</span>
                </div>
                <div class="post-header-right" style="display: flex; gap: 6px;">
                    <button class="inline-edit-toggle-btn" data-id="${data.id}" style="padding: 4px 10px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">編集</button>
                    <button class="delete-btn" data-id="${data.id}">削除</button>
                </div>
            </div>
            <h3 class="post-unit-title">
                <span class="post-number-badge">${postNoStr}</span>
                <span class="unit-number-badge">${unitNoStr}</span>
                <span>${escapeHTML(data.unitName || '名称未設定')}</span>
            </h3>
            
            <div class="card-body-content" style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;">
                ${data.imageUrl ? `<div style="flex: 1; min-width: 280px; max-width: 500px;"><img src="${data.imageUrl}" class="post-image" alt="投稿画像" loading="lazy" style="width: 100%; height: auto; border-radius: 4px;"></div>` : ''}
                <div style="flex: 1; min-width: 220px; background: #1e1e1e; padding: 12px 16px; border-radius: 6px; border: 1px solid #333;">
                    <div style="font-size: 12px; color: #aaa; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px; font-weight: bold;">✨ 登録特殊能力</div>
                    ${abilityBadgesHTML}
                </div>
            </div>

            <div class="inline-edit-container" id="inline-edit-${data.id}" style="display: none; margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 6px; border: 1px solid #444;"></div>
        `;

        const inlineEditContainer = card.querySelector(`#inline-edit-${data.id}`);
        const inlineEditToggleBtn = card.querySelector('.inline-edit-toggle-btn');

        inlineEditToggleBtn.addEventListener('click', () => {
            const isVisible = inlineEditContainer.style.display === 'block';
            if (isVisible) {
                inlineEditContainer.style.display = 'none';
                inlineEditToggleBtn.textContent = '編集';
                return;
            }

            const inputKey = prompt('投稿データを編集するには削除キー（または管理者パスワード）を入力してください：');
            if (inputKey === null) return;
            const trimmedKey = inputKey.trim();

            if (trimmedKey !== ADMIN_PASS && trimmedKey !== data.deleteKey) {
                alert('削除キー（またはパスワード）が違います。');
                return;
            }

            const currentAbilitiesMap = {};
            if (data.abilities && Array.isArray(data.abilities)) {
                data.abilities.forEach((item, idx) => {
                    const no = item.no || (idx + 1);
                    const text = typeof item === 'string' ? item : item.text;
                    currentAbilitiesMap[no] = text;
                });
            }

            let editorHTML = `<h4 style="margin-top:0; margin-bottom:12px; color:#ff9800; font-size:14px;">🛠 投稿データの直接編集</h4>`;
            editorHTML += `
                <div style="margin-bottom: 15px; background: #1f1f1f; padding: 10px; border-radius: 4px; border: 1px solid #444;">
                    <div>
                        <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 4px;">機体名（変更すると機体No.もCSVから自動更新されます）</label>
                        <input type="text" id="edit-unit-name-${data.id}" value="${escapeHTML(data.unitName || '')}" style="width: 100%; padding: 6px; box-sizing: border-box; background: #1a1c1e; color: #fff; border: 1px solid #555; border-radius: 4px;">
                    </div>
                </div>
            `;

            editorHTML += `
                <div class="ability-toolbar">
                    <div class="ability-toolbar-info">
                        <strong style="color: #ff9800;">特殊能力 (No.1 〜 No.11)</strong>
                        <span class="ability-toolbar-selected">選択中: なし</span>
                    </div>
                    <div class="ability-toolbar-buttons">
                        <button type="button" class="toolbar-move-btn toolbar-up-btn" disabled>⬆️ 上へ</button>
                        <button type="button" class="toolbar-move-btn toolbar-down-btn" disabled>⬇️ 下へ</button>
                    </div>
                </div>
            `;

            editorHTML += `<div class="inline-ability-list" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px;">`;

            for (let i = 1; i <= 11; i++) {
                const val = currentAbilitiesMap[i] || '';
                editorHTML += `
                    <div class="inline-ability-row">
                        <span class="ability-label-num" style="font-size: 12px; min-width: 45px; color: #00d4ff; font-weight: bold;">No.${i}</span>
                        <select class="inline-ability-select" style="flex: 1; padding: 6px; color: #fff; background: #222; border: 1px solid #555; border-radius: 4px;">
                            ${createAbilityOptionsHTML(val)}
                        </select>
                    </div>
                `;
            }
            editorHTML += `</div>`;
            editorHTML += `
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="inline-cancel-btn" style="padding: 6px 12px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
                    <button class="inline-save-btn" data-id="${data.id}" style="padding: 6px 14px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">変更を保存</button>
                </div>
            `;

            inlineEditContainer.innerHTML = editorHTML;
            inlineEditContainer.style.display = 'block';
            inlineEditToggleBtn.textContent = '閉じる';

            const inlineRows = inlineEditContainer.querySelectorAll('.inline-ability-row');
            inlineRows.forEach(row => {
                const sel = row.querySelector('.inline-ability-select');
                updateSelectBackground(sel);

                // 行をクリックしたら選択状態にする
                row.addEventListener('click', () => {
                    selectAbilityRow(inlineEditContainer, row);
                });

                // セレクトボックスを操作・フォーカスしたときもその行を選択状態にし、表示を更新する
                sel.addEventListener('focus', () => {
                    selectAbilityRow(inlineEditContainer, row);
                });

                sel.addEventListener('change', () => {
                    updateSelectBackground(sel);
                    selectAbilityRow(inlineEditContainer, row);
                });
            });

            // 集中「⬆️ 上へ」ボタン（選択状態を保持したまま連続移動）
            const upBtn = inlineEditContainer.querySelector('.toolbar-up-btn');
            upBtn.addEventListener('click', () => {
                const currentRow = inlineEditContainer.querySelector('.inline-ability-row.selected');
                if (!currentRow) return;
                const prevRow = currentRow.previousElementSibling;
                if (prevRow) {
                    currentRow.parentNode.insertBefore(currentRow, prevRow);
                    refreshAbilityRowsState(inlineEditContainer);
                }
            });

            // 集中「⬇️ 下へ」ボタン（選択状態を保持したまま連続移動）
            const downBtn = inlineEditContainer.querySelector('.toolbar-down-btn');
            downBtn.addEventListener('click', () => {
                const currentRow = inlineEditContainer.querySelector('.inline-ability-row.selected');
                if (!currentRow) return;
                const nextRow = currentRow.nextElementSibling;
                if (nextRow) {
                    currentRow.parentNode.insertBefore(nextRow, currentRow);
                    refreshAbilityRowsState(inlineEditContainer);
                }
            });

            inlineEditContainer.querySelector('.inline-cancel-btn').addEventListener('click', () => {
                inlineEditContainer.style.display = 'none';
                inlineEditToggleBtn.textContent = '編集';
            });

            inlineEditContainer.querySelector('.inline-save-btn').addEventListener('click', async (e) => {
                const saveBtn = e.target;
                saveBtn.disabled = true;
                saveBtn.textContent = '保存中...';

                try {
                    const newUnitName = document.getElementById(`edit-unit-name-${data.id}`).value.trim();

                    if (!newUnitName) {
                        alert('機体名は必須です。');
                        saveBtn.disabled = false;
                        saveBtn.textContent = '変更を保存';
                        return;
                    }

                    let newUnitNumber = machineDataMap.get(newUnitName) || formatUnitNo(data.unitNumber) || '';

                    const rows = inlineEditContainer.querySelectorAll('.inline-ability-row');
                    const newAbilities = [];

                    rows.forEach((r, idx) => {
                        const no = idx + 1;
                        const select = r.querySelector('.inline-ability-select');
                        const text = select.value.trim();
                        if (text) {
                            newAbilities.push({ no, text });
                        }
                    });

                    const postRef = doc(db, "posts", data.id);
                    await updateDoc(postRef, {
                        unitNumber: newUnitNumber,
                        unitName: newUnitName,
                        abilities: newAbilities
                    });

                    alert('投稿データを更新しました！');
                    await loadPosts();

                } catch (err) {
                    console.error("更新エラー:", err);
                    alert('更新に失敗しました: ' + err.message);
                    saveBtn.disabled = false;
                    saveBtn.textContent = '変更を保存';
                }
            });
        });

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            handlePostDelete(db, data.id, data.deleteKey, loadPosts);
        });

        postList.appendChild(card);
    });

    if (displayLimit < postsToRender.length) {
        const loadMoreContainer = document.createElement('div');
        loadMoreContainer.style.cssText = 'text-align: center; margin: 25px 0;';
        
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.textContent = `もっと見る （残り ${postsToRender.length - displayLimit} 件）`;
        loadMoreBtn.style.cssText = 'padding: 10px 24px; background-color: #333; color: #fff; border: 1px solid #555; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; transition: background 0.2s;';
        
        loadMoreBtn.onmouseover = () => loadMoreBtn.style.backgroundColor = '#444';
        loadMoreBtn.onmouseout = () => loadMoreBtn.style.backgroundColor = '#333';

        loadMoreBtn.addEventListener('click', () => {
            displayLimit += 10;
            renderPosts(postsToRender);
        });

        loadMoreContainer.appendChild(loadMoreBtn);
        postList.appendChild(loadMoreContainer);
    }
}

tableSearchInput.addEventListener('input', () => {
    applySortAndRenderTable();
});

searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();

    if (!keyword) {
        displayLimit = 10;
        renderPosts(allPosts);
        return;
    }

    const filteredPosts = allPosts.filter(post => {
        const postNoStr = post.postNo ? `no.${post.postNo}` : '';
        const rawPostNoStr = post.postNo ? String(post.postNo) : '';
        const unitNumberMatch = (post.unitNumber || '').toLowerCase().includes(keyword);
        const unitNameMatch = (post.unitName || '').toLowerCase().includes(keyword);
        const authorMatch = (post.author || '').toLowerCase().includes(keyword);
        const postNoMatch = postNoStr.includes(keyword) || rawPostNoStr.includes(keyword);
        
        return unitNameMatch || unitNumberMatch || authorMatch || postNoMatch;
    });

    displayLimit = filteredPosts.length;
    renderPosts(filteredPosts);
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = imageFileInput.files[0];
    const unitName = document.getElementById('unit-name').value.trim();
    
    let unitNumber = formatUnitNo(document.getElementById('unit-number').value);
    if (!unitNumber && unitName && machineDataMap.has(unitName)) {
        unitNumber = machineDataMap.get(unitName);
    }

    const author = document.getElementById('author').value.trim();
    const deleteKey = document.getElementById('delete-key').value.trim();

    const selectedAbilities = [];
    for (let i = 1; i <= 11; i++) {
        const selectEl = document.getElementById(`ability-${i}`);
        const val = selectEl ? selectEl.value.trim() : '';
        if (val) {
            selectedAbilities.push({
                no: i,
                text: val
            });
        }
    }

    const success = await handlePostSubmit({
        db,
        file,
        unitNumber,
        unitName,
        author,
        deleteKey,
        submitBtn,
        customAbilities: selectedAbilities,
        allPosts: allPosts
    });

    if (success) {
        form.reset();
        loadSavedCredentials();

        for (let i = 1; i <= 11; i++) {
            const selectEl = document.getElementById(`ability-${i}`);
            if (selectEl) {
                selectEl.value = '';
                updateSelectBackground(selectEl);
            }
        }

        searchInput.value = '';
        tableSearchInput.value = '';
        await loadPosts();
    }
});

// --- 手持ち機体テキストの未登録チェック処理 ---
document.addEventListener('DOMContentLoaded', () => {
    const checkBtn = document.getElementById('check-units-btn');
    if (checkBtn) {
        checkBtn.addEventListener('click', () => {
            const rawText = document.getElementById('raw-units-input').value;
            if (!rawText.trim()) {
                alert('手持ち機体データを貼り付けてください。');
                return;
            }

            const userRegisteredNamesMap = new Map();
            allPosts.forEach(p => {
                if (p.unitName) {
                    const cleanName = p.unitName.trim();
                    userRegisteredNamesMap.set(cleanName.toLowerCase(), cleanName);
                }
            });

            const lines = rawText.split('\n');
            const unregisteredSet = new Set();
            const registeredSet = new Set();

            lines.forEach(line => {
                let trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('ユニット数')) return;

                let cleaned = trimmedLine.replace(/[✨Ψ]/g, '');
                cleaned = cleaned.replace(/\s+展示中.*$/, '');

                let match = cleaned.match(/^(.+?)(?=\s+\d+\/\d+|\s+\d+$)/);
                let unitName = '';

                if (match) {
                    unitName = match[1].trim();
                } else {
                    unitName = cleaned.trim();
                }

                unitName = unitName.replace(/^\d+[\.\s\t]+/, '').trim();

                if (!unitName || unitName === '改装設計図') return;

                const lowerUnitName = unitName.toLowerCase();
                if (userRegisteredNamesMap.has(lowerUnitName)) {
                    registeredSet.add(userRegisteredNamesMap.get(lowerUnitName));
                } else {
                    unregisteredSet.add(unitName);
                }
            });

            renderCheckResults('unregistered-list', 'unregistered-count', Array.from(unregisteredSet), 'unregistered-badge-item', 'すべての機体が登録済みです！');
            renderCheckResults('registered-check-list', 'registered-check-count', Array.from(registeredSet), 'registered-badge-item', '該当する機体はありません。');
        });
    }
});

function renderCheckResults(listId, countId, items, className, emptyMsg) {
    const ul = document.getElementById(listId);
    const countBadge = document.getElementById(countId);

    ul.innerHTML = '';
    countBadge.textContent = items.length + '件';

    if (items.length === 0) {
        ul.innerHTML = `<li style="padding: 12px; color: #777; text-align: center;">${emptyMsg}</li>`;
        return;
    }

    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        li.className = className;
        ul.appendChild(li);
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ページ読み込み時の初期化処理
document.addEventListener('DOMContentLoaded', async () => {
    initAbilityDropdowns();
    loadSavedCredentials();
    await loadMachineCsvForJs();
    loadPosts();
});
