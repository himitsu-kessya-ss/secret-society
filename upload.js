import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 外出しした投稿処理モジュールをインポート
import { handlePostSubmit, handlePostDelete } from "./post-handler.js";

const firebaseConfig = {
    apiKey: "AIzaSyAKnEENO4tuGtFHsTOAWusbUNPzzUiMNMY",
    authDomain: "himitsukessya-aa509.firebaseapp.com",
    projectId: "himitsukessya-aa509",
    storageBucket: "himitsukessya-aa509.firebasestorage.app",
    messagingSenderId: "584936417780",
    appId: "1:584936417780:web:7702b98ea7faf7ccfbb1a1",
    measurementId: "G-9XBXVQN1JC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById('upload-form');
const submitBtn = document.getElementById('submit-btn');
const postList = document.getElementById('post-list');
const loadingMsg = document.getElementById('loading-msg');
const searchInput = document.getElementById('search-input');
const tableSearchInput = document.getElementById('table-search-input');
const tableBody = document.getElementById('registered-table-body');

let allPosts = [];

// 投稿一覧データの読み込み
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

        renderPosts(allPosts);
        renderRegisteredTable(allPosts);

    } catch (error) {
        console.error("読み込みエラー:", error);
        loadingMsg.textContent = 'データの読み込みに失敗しました。画面を再読み込みしてください。';
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger-color);">データの読み込みに失敗しました。</td></tr>';
    }
}

// 登録済み機体一覧テーブルの描画
function renderRegisteredTable(posts) {
    tableBody.innerHTML = '';

    if (posts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--sub-text);">該当する機体データはありません。</td></tr>';
        return;
    }

    const sortedPosts = [...posts].sort((a, b) => {
        const numA = parseInt(a.unitNumber, 10) || 0;
        const numB = parseInt(b.unitNumber, 10) || 0;
        return numA - numB;
    });

    sortedPosts.forEach(data => {
        const tr = document.createElement('tr');
        const unitNo = escapeHTML(data.unitNumber || '----');
        const unitName = escapeHTML(data.unitName || '名称未設定');
        const imgUrl = data.imageUrl || '#';

        let abilityBadgesHTML = '';
        
        if (data.abilities && Array.isArray(data.abilities) && data.abilities.length > 0) {
            abilityBadgesHTML = data.abilities.map(item => `
                <span class="ability-badge">
                    <span class="ability-num">No.${item.no}</span>
                    ${escapeHTML(item.text)}
                </span>
            `).join('');
        } else {
            const oldAbilities = [];
            if (data.ability1) oldAbilities.push({ no: 1, text: data.ability1 });
            if (data.ability2) oldAbilities.push({ no: 2, text: data.ability2 });
            if (data.ability3) oldAbilities.push({ no: 3, text: data.ability3 });

            if (oldAbilities.length > 0) {
                abilityBadgesHTML = oldAbilities.map(item => `
                    <span class="ability-badge">
                        <span class="ability-num">No.${item.no}</span>
                        ${escapeHTML(item.text)}
                    </span>
                `).join('');
            } else {
                abilityBadgesHTML = '<span style="color:#666;">-</span>';
            }
        }

        tr.innerHTML = `
            <td><span class="unit-no-badge">${unitNo}</span></td>
            <td><strong>${unitName}</strong></td>
            <td><div class="ability-container">${abilityBadgesHTML}</div></td>
            <td><a href="${imgUrl}" target="_blank" rel="noopener noreferrer" class="img-link-btn">🔗 画像を見る</a></td>
        `;
        tableBody.appendChild(tr);
    });
}

// 投稿カードリストの描画
function renderPosts(postsToRender) {
    postList.innerHTML = '';

    if (postsToRender.length === 0) {
        postList.innerHTML = '<p style="color: var(--sub-text); text-align: center; padding: 30px 0;">該当する投稿が見つかりませんでした。</p>';
        return;
    }

    postsToRender.forEach((data) => {
        const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('ja-JP') : '日時不明';
        const postNoStr = data.postNo ? `投稿 No.${data.postNo}` : '投稿 No.--';
        const unitNoStr = data.unitNumber ? `機体 No.${escapeHTML(data.unitNumber)}` : '機体 No.----';

        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div class="post-header">
                <div class="post-header-left">
                    <span class="post-author">${escapeHTML(data.author || '名無し')}</span>
                    <span class="post-date">${dateStr}</span>
                </div>
                <button class="delete-btn" data-id="${data.id}">削除</button>
            </div>
            <h3 class="post-unit-title">
                <span class="post-number-badge">${postNoStr}</span>
                <span class="unit-number-badge">${unitNoStr}</span>
                <span>${escapeHTML(data.unitName || '名称未設定')}</span>
            </h3>
            ${data.imageUrl ? `<img src="${data.imageUrl}" class="post-image" alt="投稿画像" loading="lazy">` : ''}
        `;

        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            handlePostDelete(db, data.id, data.deleteKey, loadPosts);
        });

        postList.appendChild(card);
    });
}

// テーブル検索フィルター
tableSearchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();

    if (!keyword) {
        renderRegisteredTable(allPosts);
        return;
    }

    const filteredTableData = allPosts.filter(post => {
        const unitNumberMatch = (post.unitNumber || '').toLowerCase().includes(keyword);
        const unitNameMatch = (post.unitName || '').toLowerCase().includes(keyword);
        
        let abilityMatch = false;
        if (post.abilities && Array.isArray(post.abilities)) {
            abilityMatch = post.abilities.some(item => item.text.toLowerCase().includes(keyword));
        } else {
            abilityMatch = (post.ability1 || '').toLowerCase().includes(keyword) ||
                           (post.ability2 || '').toLowerCase().includes(keyword) ||
                           (post.ability3 || '').toLowerCase().includes(keyword);
        }

        return unitNameMatch || unitNumberMatch || abilityMatch;
    });

    renderRegisteredTable(filteredTableData);
});

// 投稿カード検索フィルター
searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();

    if (!keyword) {
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

    renderPosts(filteredPosts);
});

// フォーム送信処理
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = document.getElementById('image-file').files[0];
    const unitNumber = document.getElementById('unit-number').value.trim();
    const unitName = document.getElementById('unit-name').value.trim();
    const author = document.getElementById('author').value.trim();
    const deleteKey = document.getElementById('delete-key').value.trim();

    const success = await handlePostSubmit({
        db,
        file,
        unitNumber,
        unitName,
        author,
        deleteKey,
        submitBtn
    });

    if (success) {
        form.reset();
        searchInput.value = '';
        tableSearchInput.value = '';
        await loadPosts();
    }
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// 初期読み込み
loadPosts();
