import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 各種モジュールのインポート
import { handlePostSubmit, handlePostDelete } from "./upload_post-handler.js";
import { MASTER_ABILITIES } from "./ability-master.js";
import { analyzeImageAbilities } from "./upload_ocr-processor.js";

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
const imageFileInput = document.getElementById('image-file');

// 入力保持用のストレージキー
const STORAGE_KEY_AUTHOR = 'ss_upload_author';
const STORAGE_KEY_DELETE_KEY = 'ss_upload_delete_key';

let allPosts = [];
let editingPostId = null; // 編集中のデータID（nullなら新規登録）

// --- 初期化：No.1 〜 No.9 のセレクトボックスにマスター辞書の選択肢を流し込む ---
function initAbilityDropdowns() {
    for (let i = 1; i <= 9; i++) {
        const selectEl = document.getElementById(`ability-${i}`);
        if (!selectEl) continue;

        selectEl.innerHTML = '<option value="">-- 未選択 --</option>';

        MASTER_ABILITIES.forEach(ability => {
            const option = document.createElement('option');
            option.value = ability;
            option.textContent = ability;
            selectEl.appendChild(option);
        });
    }
}

// --- 保存された投稿者名・削除キーの復元 ---
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
            abilityBadgesHTML = '<span style="color:#666;">-</span>';
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

        const editBtn = tr.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            startEditing(data);
        });

        tableBody.appendChild(tr);
    });
}

// 編集モードに入る関数
function startEditing(postData) {
    editingPostId = postData.id;

    document.getElementById('unit-number').value = postData.unitNumber || '';
    document.getElementById('unit-name').value = postData.unitName || '';
    document.getElementById('author').value = postData.author || '';

    for (let i = 1; i <= 9; i++) {
        const selectEl = document.getElementById(`ability-${i}`);
        if (selectEl) selectEl.value = '';
    }

    const abilities = postData.abilities || [];
    abilities.forEach(item => {
        const selectEl = document.getElementById(`ability-${item.no}`);
        if (selectEl) {
            selectEl.value = item.text || '';
        }
    });

    submitBtn.textContent = 'データを更新する';
    submitBtn.style.backgroundColor = '#ff9800';

    form.scrollIntoView({ behavior: 'smooth' });
}

// --- 画像選択時にOCR解析を行い、自動でプルダウンに結果をセットする処理 ---
imageFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (editingPostId) return; 

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'OCR解析中...';

        for (let i = 1; i <= 9; i++) {
            const selectEl = document.getElementById(`ability-${i}`);
            if (selectEl) selectEl.value = '';
        }

        const detectedAbilities = await analyzeImageAbilities(file);

        detectedAbilities.forEach(item => {
            const selectEl = document.getElementById(`ability-${item.no}`);
            if (selectEl) {
                selectEl.value = item.text;
            }
        });

    } catch (err) {
        console.error("OCR自動解析エラー:", err);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '投稿する';
    }
});

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

    const file = imageFileInput.files[0];
    const unitNumber = document.getElementById('unit-number').value.trim();
    const unitName = document.getElementById('unit-name').value.trim();
    const author = document.getElementById('author').value.trim();
    const deleteKey = document.getElementById('delete-key').value.trim();

    // ★ 投稿者名と削除キーをブラウザに保存（次回も自動入力されるようにする）
    localStorage.setItem(STORAGE_KEY_AUTHOR, author);
    localStorage.setItem(STORAGE_KEY_DELETE_KEY, deleteKey);

    const selectedAbilities = [];
    for (let i = 1; i <= 9; i++) {
        const selectEl = document.getElementById(`ability-${i}`);
        const val = selectEl ? selectEl.value.trim() : '';
        if (val) {
            selectedAbilities.push({
                no: i,
                text: val
            });
        }
    }

    if (editingPostId) {
        // --- データの更新処理 ---
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '更新中...';

            const postRef = doc(db, "posts", editingPostId);
            await updateDoc(postRef, {
                unitNumber: unitNumber,
                unitName: unitName,
                author: author,
                abilities: selectedAbilities,
                updatedAt: new Date()
            });

            alert('データを更新しました！');

            form.reset();
            editingPostId = null;
            submitBtn.textContent = '投稿する';
            submitBtn.style.backgroundColor = '';
            
            // 更新時も保存した名前とキーは維持・再適用する
            loadSavedCredentials();

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
        // --- 新規登録処理 ---
        const success = await handlePostSubmit({
            db,
            file,
            unitNumber,
            unitName,
            author,
            deleteKey,
            submitBtn,
            customAbilities: selectedAbilities
        });

        if (success) {
            form.reset();
            
            // フォームリセットで消えてしまうため、直前の投稿者名と削除キーを再セットする
            loadSavedCredentials();

            // 画像ファイル選択や特殊能力プルダウン、機体No/機体名などを綺麗にする（必要に応じて）
            for (let i = 1; i <= 9; i++) {
                const selectEl = document.getElementById(`ability-${i}`);
                if (selectEl) selectEl.value = '';
            }

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

// 初期化処理
initAbilityDropdowns();
loadSavedCredentials(); // ページ読み込み時に保存された名前とキーを復元
loadPosts();
