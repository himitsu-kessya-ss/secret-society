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

// --- 機体名(キー)と機体No.(バリュー)の対応マップ ---
let machineDataMap = new Map();

// --- ソート状態管理 ---
let currentSortColumn = 'unitNo';
let currentSortDirection = 'asc';

// --- 初期化：CSVデータの読み込み（routeフォルダ内） ---
async function loadMachineCsvForJs() {
    try {
        const response = await fetch('../route/GL)機体一覧 - 機体一覧.csv');
        if (!response.ok) throw new Error('CSVファイルの取得に失敗しました。');
        const csvText = await response.text();
        
        const lines = csvText.split(/\r\n|\n/);
        lines.forEach(line => {
            if (!line.trim()) return;
            const cols = line.split(',');
            if (cols.length >= 2) {
                const machineNo = cols[0].trim();   // 1列目：機体No.
                const machineName = cols[1].trim(); // 2列目：機体名
                if (machineNo && machineName) {
                    machineDataMap.set(machineName, machineNo);
                }
            }
        });
    } catch (error) {
        console.error('機体一覧CSV読み込みエラー:', error);
    }
}

// --- 初期化：No.1 〜 No.9 セレクトボックスの生成 ---
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
        selectEl.style.backgroundColor = '#1a1a1a';
        selectEl.style.borderColor = '#555';
        selectEl.style.color = '#fff';
    }
}

function initAbilityDropdowns() {
    for (let i = 1; i <= 9; i++) {
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

// 投稿一覧データの読み込み＆ランキング集計
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
        renderRanking(allPosts); // ランキング描画の実行

    } catch (error) {
        console.error("読み込みエラー:", error);
        loadingMsg.textContent = 'データの読み込みに失敗しました。画面を再読み込みしてください。';
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger-color);">データの読み込みに失敗しました。</td></tr>';
    }
}

// --- 投稿ランキング（Special Thanks）集計・表示処理 ---
function renderRanking(posts) {
    const top3Container = document.getElementById('top3-ranking-container');
    const rankingTableBody = document.getElementById('ranking-table-body');
    if (!top3Container || !rankingTableBody) return;

    // 投稿者（author）ごとにカウント集計
    const authorCounts = {};
    posts.forEach(post => {
        const author = (post.author || '名無しパイロット').trim();
        authorCounts[author] = (authorCounts[author] || 0) + 1;
    });

    // カウント順にソート（配列に変換）
    const sortedRanking = Object.keys(authorCounts).map(author => {
        return { author, count: authorCounts[author] };
    }).sort((a, b) => b.count - a.count);

    top3Container.innerHTML = '';
    rankingTableBody.innerHTML = '';

    if (sortedRanking.length === 0) {
        rankingTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--sub-text);">投稿データがまだありません。</td></tr>';
        return;
    }

    // 1. トップ3の表彰カード描画
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

    // 2. 全体ランキングテーブルの描画
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
        const unitNo = escapeHTML(data.unitNumber || '----');
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

        for (let i = 1; i <= 9; i++) {
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
        const unitNoStr = data.unitNumber ? `機体 No.${escapeHTML(data.unitNumber)}` : '機体 No.----';

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
            if (isVisible)
