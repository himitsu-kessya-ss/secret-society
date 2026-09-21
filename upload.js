import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ファイル名を変更したモジュールをインポート
import { handlePostSubmit, handlePostDelete } from "./upload_post-handler.js";

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
let editingPostId = null; // 編集中のデータID（nullなら新規登録）

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
            <td>
                <a href="${imgUrl}" target="_blank" rel="noopener noreferrer" class="img-link-btn">🔗 画像を見る</a>
                <button class="edit-btn" data-id="${data.id}" style="margin-left: 6px; padding: 4px 8px; cursor: pointer; background-color: #2196F3; color: white; border: none; border-radius: 4px;">編集</button>
            </td>
        `;

        // 編集ボタンが押されたときの処理
        const editBtn = tr.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            startEditing(data);
        });

        tableBody.appendChild(tr);
    });
}

// 編集モードに入る関数（基本情報 ＋ No.1〜No.9 のアビリティをフォームにセット）
function startEditing(postData) {
    editingPostId = postData.id;

    // 基本情報のセット
    document.getElementById('unit-number').value = postData.unitNumber || '';
    document.getElementById('unit-name').value = postData.unitName || '';
    document.getElementById('author').value = postData.author || '';

    // 特殊能力（No.1〜No.9）の入力欄をクリアしてから既存データをセット
    for (let i = 1; i <= 9; i++) {
        const inputEl = document.getElementById(`ability-${i}`);
        if (inputEl) inputEl.value = '';
    }

    const abilities = postData.abilities || [];
    abilities.forEach(item => {
        const inputEl = document.getElementById(`ability-${item.no}`);
        if (inputEl) {
            inputEl.value = item.text || '';
        }
    });

    // 送信ボタンの見た目を「更新用」に変更
    submitBtn.textContent = 'データを更新する';
    submitBtn.style.backgroundColor = '#ff9800';

    // フォームの位置までスムーズにスクロール
    form.scrollIntoView({ behavior: 'smooth' });
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

// フォーム送信処理（新規登録 or 更新の分岐）
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = document.getElementById('image-file').files[0];
    const unitNumber = document.getElementById('unit-number').value.trim();
    const unitName = document.getElementById('unit-name').value.trim();
    const author = document.getElementById('author').value.trim();
    const deleteKey = document.getElementById('delete-key').value.trim();

    if (editingPostId) {
        // --- データの更新処理（手動修正されたNo.1〜No.9のアビリティを反映） ---
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '更新中...';

            // 入力されたNo.1〜No.9の特殊能力を配列として再構築（入力があるものだけ抽出・整理）
            const updatedAbilities = [];
            for (let i = 1; i <= 9; i++) {
                const val = document.getElementById(`ability-${i}`)?.value.trim();
                if (val) {
                    updatedAbilities.push({
                        no: i, // 入力された番号(No.x)をそのまま保持
                        text: val
                    });
                }
            }

            const postRef = doc(db, "posts", editingPostId);
            await updateDoc(postRef, {
                unitNumber: unitNumber,
                unitName: unitName,
                author: author,
                abilities: updatedAbilities, // 修正されたアビリティリストを保存
                updatedAt: new Date()
            });

            alert('データを更新しました！');

            form.reset();
            editingPostId = null;
            submitBtn.textContent = '投稿する';
            submitBtn.style.backgroundColor = '';
            searchInput.value = '';
            tableSearchInput.value = '';
            await loadPosts();

        } catch (error) {
            console.error("更新エラー:", error);
            alert('データの更新に失敗しました：' + error.message);
        } finally {
            submitBtn.disabled = false;
        }

    } else {
        // --- 従来の新規登録処理 ---
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
    }
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// 初期読み込み
loadPosts();
