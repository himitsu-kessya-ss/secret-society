<!-- upload.js -->

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
let displayLimit = 10; // 初期表示件数

// --- 初期化：No.1 〜 No.9 のセレクトボックスにマスター辞書の選択肢を流し込む（共通ヘルパー） ---
function createAbilityOptionsHTML(selectedValue = '') {
    let html = '<option value="">-- 未選択 --</option>';
    MASTER_ABILITIES.forEach(ability => {
        const selected = ability === selectedValue ? 'selected' : '';
        html += `<option value="${escapeHTML(ability)}" ${selected}>${escapeHTML(ability)}</option>`;
    });
    return html;
}

// 選択状態に応じてプルダウンの背景色を切り替えるヘルパー
function updateSelectBackground(selectEl) {
    if (selectEl.value) {
        // 選択されている場合（アクセントカラー：暗めのオレンジ/ブラウン系）
        selectEl.style.backgroundColor = '#3a2711';
        selectEl.style.borderColor = '#d97706';
        selectEl.style.color = '#ffedd5';
    } else {
        // 未選択の場合（デフォルトの暗い背景）
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
        
        // 値変更時にも色を動的に変更
        selectEl.addEventListener('change', () => {
            updateSelectBackground(selectEl);
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

        displayLimit = 10; // データ再読み込み時は10件にリセット
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
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// --- 画像選択時にOCR解析を行い、自動でプルダウンに結果をセットする処理 ---
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

// 投稿カードリストの描画（直近10件制限 ＋ もっと見るボタン対応）
function renderPosts(postsToRender) {
    postList.innerHTML = '';

    if (postsToRender.length === 0) {
        postList.innerHTML = '<p style="color: var(--sub-text); text-align: center; padding: 30px 0;">該当する投稿が見つかりませんでした。</p>';
        return;
    }

    // 表示する件数を制限
    const slicedPosts = postsToRender.slice(0, displayLimit);

    slicedPosts.forEach((data) => {
        const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('ja-JP') : '日時不明';
        const postNoStr = data.postNo ? `投稿 No.${data.postNo}` : '投稿 No.--';
        const unitNoStr = data.unitNumber ? `機体 No.${escapeHTML(data.unitNumber)}` : '機体 No.----';

        // 特殊能力一覧のHTML生成
        let abilityBadgesHTML = '';
        if (data.abilities && Array.isArray(data.abilities) && data.abilities.length > 0) {
            abilityBadgesHTML = data.abilities.map(item => `
                <div style="display: flex; align-items: center; margin-bottom: 6px; font-size: 13px;">
                    <span style="background: #333; color: #ff9800; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 8px; font-weight: bold; min-width: 42px; text-align: center;">No.${item.no}</span>
                    <span style="color: #fff;">${escapeHTML(item.text)}</span>
                </div>
            `).join('');
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
            
            <!-- ▼ 画像と特殊能力リストを横並びにするエリア -->
            <div class="card-body-content" style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;">
                ${data.imageUrl ? `<div style="flex: 1; min-width: 280px; max-width: 500px;"><img src="${data.imageUrl}" class="post-image" alt="投稿画像" loading="lazy" style="width: 100%; height: auto; border-radius: 4px;"></div>` : ''}
                <div style="flex: 1; min-width: 220px; background: #1e1e1e; padding: 12px 16px; border-radius: 6px; border: 1px solid #333;">
                    <div style="font-size: 12px; color: #aaa; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px; font-weight: bold;">✨ 登録特殊能力</div>
                    ${abilityBadgesHTML}
                </div>
            </div>

            <!-- ▼ インライン編集用コンテナ -->
            <div class="inline-edit-container" id="inline-edit-${data.id}" style="display: none; margin-top: 15px; padding: 15px; background: #2a2a2a; border-radius: 6px; border: 1px solid #444;"></div>
        `;

        const inlineEditContainer = card.querySelector(`#inline-edit-${data.id}`);
        const inlineEditToggleBtn = card.querySelector('.inline-edit-toggle-btn');

        // 「編集」ボタンのクリック処理（認証チェック＆エディタ表示切替）
        inlineEditToggleBtn.addEventListener('click', () => {
            const isVisible = inlineEditContainer.style.display === 'block';
            if (isVisible) {
                inlineEditContainer.style.display = 'none';
                inlineEditToggleBtn.textContent = '編集';
                return;
            }

            // 編集時の認証
            const inputKey = prompt('投稿データを編集するには削除キー（または管理者パスワード）を入力してください：');
            if (inputKey === null) return;
            const trimmedKey = inputKey.trim();

            if (trimmedKey !== ADMIN_PASS && trimmedKey !== data.deleteKey) {
                alert('削除キー（またはパスワード）が違います。');
                return;
            }

            // 既存のアビリティデータをマップ化
            const currentAbilitiesMap = {};
            if (data.abilities && Array.isArray(data.abilities)) {
                data.abilities.forEach(item => {
                    currentAbilitiesMap[item.no] = item.text;
                });
            }

            // インディケーター（エディタUI）を組み立て（機体ナンバー・機体名・特殊能力）
            let editorHTML = `<h4 style="margin-top:0; margin-bottom:12px; color:#ff9800; font-size:14px;">🛠 投稿データの直接編集</h4>`;
            
            // 機体ナンバー・機体名入力エリア
            editorHTML += `
                <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-bottom: 15px; background: #1f1f1f; padding: 10px; border-radius: 4px; border: 1px solid #444;">
                    <div>
                        <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 4px;">機体ナンバー (4桁)</label>
                        <input type="text" id="edit-unit-number-${data.id}" value="${escapeHTML(data.unitNumber || '')}" maxlength="4" pattern="\\d{4}" style="width: 100%; padding: 6px; box-sizing: border-box; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 4px;">機体名</label>
                        <input type="text" id="edit-unit-name-${data.id}" value="${escapeHTML(data.unitName || '')}" style="width: 100%; padding: 6px; box-sizing: border-box; background: #1a1a1a; color: #fff; border: 1px solid #555; border-radius: 4px;">
                    </div>
                </div>
            `;

            editorHTML += `<div style="font-size: 12px; color: #ff9800; margin-bottom: 6px; font-weight: bold;">特殊能力 (No.1 〜 No.9)</div>`;
            editorHTML += `<div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 15px;">`;

            for (let i = 1; i <= 9; i++) {
                const val = currentAbilitiesMap[i] || '';
                editorHTML += `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12px; min-width: 40px; color: #aaa;">No.${i}</span>
                        <select class="inline-ability-select" data-no="${i}" style="flex: 1; padding: 6px; color: #fff; border: 1px solid #555; border-radius: 4px;">
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

            // インラインエディタ内のセレクトボックスにも背景色制御を適用
            const inlineSelects = inlineEditContainer.querySelectorAll('.inline-ability-select');
            inlineSelects.forEach(sel => {
                updateSelectBackground(sel);
                sel.addEventListener('change', () => {
                    updateSelectBackground(sel);
                });
            });

            // キャンセルボタンのイベント
            inlineEditContainer.querySelector('.inline-cancel-btn').addEventListener('click', () => {
                inlineEditContainer.style.display = 'none';
                inlineEditToggleBtn.textContent = '編集';
            });

            // 保存ボタンのイベント
            inlineEditContainer.querySelector('.inline-save-btn').addEventListener('click', async (e) => {
                const saveBtn = e.target;
                saveBtn.disabled = true;
                saveBtn.textContent = '保存中...';

                try {
                    const newUnitNumber = document.getElementById(`edit-unit-number-${data.id}`).value.trim();
                    const newUnitName = document.getElementById(`edit-unit-name-${data.id}`).value.trim();

                    if (!newUnitNumber || !newUnitName) {
                        alert('機体ナンバーと機体名は必須です。');
                        saveBtn.disabled = false;
                        saveBtn.textContent = '変更を保存';
                        return;
                    }

                    const selects = inlineEditContainer.querySelectorAll('.inline-ability-select');
                    const newAbilities = [];

                    selects.forEach(select => {
                        const no = parseInt(select.getAttribute('data-no'), 10);
                        const text = select.value.trim();
                        if (text) {
                            newAbilities.push({ no, text });
                        }
                    });

                    // Firestoreの該当ドキュメントを更新（unitNumber, unitName, abilities）
                    const postRef = doc(db, "posts", data.id);
                    await updateDoc(postRef, {
                        unitNumber: newUnitNumber,
                        unitName: newUnitName,
                        abilities: newAbilities
                    });

                    alert('投稿データを更新しました！');
                    await loadPosts(); // リロードして最新状態に

                } catch (err) {
                    console.error("更新エラー:", err);
                    alert('更新に失敗しました: ' + err.message);
                    saveBtn.disabled = false;
                    saveBtn.textContent = '変更を保存';
                }
            });
        });

        // 削除ボタンイベント
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            handlePostDelete(db, data.id, data.deleteKey, loadPosts);
        });

        postList.appendChild(card);
    });

    // まだ全件表示しきれていない場合、「もっと見る」ボタンをリストの最後に追加
    if (displayLimit < postsToRender.length) {
        const loadMoreContainer = document.createElement('div');
        loadMoreContainer.style.cssText = 'text-align: center; margin: 25px 0;';
        
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.textContent = `もっと見る （残り ${postsToRender.length - displayLimit} 件）`;
        loadMoreBtn.style.cssText = 'padding: 10px 24px; background-color: #333; color: #fff; border: 1px solid #555; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; transition: background 0.2s;';
        
        loadMoreBtn.onmouseover = () => loadMoreBtn.style.backgroundColor = '#444';
        loadMoreBtn.onmouseout = () => loadMoreBtn.style.backgroundColor = '#333';

        loadMoreBtn.addEventListener('click', () => {
            displayLimit += 10; // 10件ずつ増やす
            renderPosts(postsToRender);
        });

        loadMoreContainer.appendChild(loadMoreBtn);
        postList.appendChild(loadMoreContainer);
    }
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
        displayLimit = 10; // 検索解除時は10件制限に戻す
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

    displayLimit = filteredPosts.length; // 検索時は該当分を一括表示
    renderPosts(filteredPosts);
});

// フォーム送信処理（新規登録）
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = imageFileInput.files[0];
    const unitNumber = document.getElementById('unit-number').value.trim();
    const unitName = document.getElementById('unit-name').value.trim();
    const author = document.getElementById('author').value.trim();
    const deleteKey = document.getElementById('delete-key').value.trim();

    // 特殊能力プルダウンから選択されている内容を収集
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

    // 新規登録処理
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
        loadSavedCredentials(); // 保存された投稿者名・削除キーを再適用

        for (let i = 1; i <= 9; i++) {
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

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ページ読み込み時の初期化処理
initAbilityDropdowns();
loadSavedCredentials();
loadPosts();
