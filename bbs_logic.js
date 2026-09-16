// ==========================================
// 秘密結社BBS - ロジック・機能スクリプト (bbs_logic.js)
// ==========================================

let currentUser = {
    name: "名無しパイロット",
    avatar: "https://api.dicebear.com/7.x/pixel-art/svg?seed=default"
};

const MASTER_ADMIN_CODE = "p@ssw0rd";

// ページ読み込み時の初期化処理（アカウント情報の取得と顔アイコンの適用）
window.onload = function() {
    const loginUserId = sessionStorage.getItem('loginUserId') || 'secret';
    const defaultAvatar = 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + loginUserId;

    // アカウントストレージから最新のプレイヤー名と顔アイコンを取得
    const accountData = JSON.parse(localStorage.getItem('secret_user_account'));
    if (accountData) {
        currentUser.name = accountData.name || sessionStorage.getItem('loginUserName') || '管理人';
        currentUser.avatar = (accountData.avatar && accountData.avatar.trim() !== '') ? accountData.avatar : defaultAvatar;
    } else {
        currentUser.name = sessionStorage.getItem('loginUserName') || '管理人';
        currentUser.avatar = defaultAvatar;
    }

    // 画面のログイン中バッジに名前とアイコンを反映
    document.getElementById('current-user-name').textContent = currentUser.name;
    const avatarBox = document.getElementById('current-user-avatar');
    if (currentUser.avatar) {
        avatarBox.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" onerror="this.onerror=null; this.parentNode.innerHTML='👤';">`;
    }

    document.getElementById('loading-msg').style.display = 'none';
    renderThreads();
};

// 現在の日時を取得する関数
function getNowDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}:${s}`;
}

// 新規スレッド作成
function createPost() {
    const contentInput = document.getElementById('contentInput');
    const imageInput = document.getElementById('imageInput');

    if (!contentInput.value.trim()) {
        alert('投稿文を入力してください。');
        return;
    }

    const files = imageInput.files;
    if (files.length > 0) {
        processImages(files, function(imageUrls) {
            saveNewThread(currentUser.name, currentUser.avatar, contentInput.value, imageUrls);
        });
    } else {
        saveNewThread(currentUser.name, currentUser.avatar, contentInput.value, []);
    }
}

// 画像のBase64変換処理
function processImages(files, callback) {
    let imageUrls = [];
    let processedCount = 0;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            imageUrls.push(e.target.result);
            processedCount++;
            if (processedCount === files.length) {
                callback(imageUrls);
            }
        };
        reader.readAsDataURL(file);
    });
}

// 新規スレッドの保存（現在のユーザーのアバターを必ず紐づけて保存）
function saveNewThread(username, avatar, content, images) {
    const newThread = {
        id: Date.now(),
        username,
        avatar, // 登録されている顔アイコンを保存
        content,
        images,
        timestamp: getNowDate(),
        replies: []
    };

    threads.unshift(newThread);
    saveAndRender();
    
    document.getElementById('contentInput').value = '';
    document.getElementById('imageInput').value = '';
}

// スレッド一覧の描画（顔アイコン＆連番対応）
function renderThreads(filterText = '') {
    const threadListEl = document.getElementById('threadList');
    threadListEl.innerHTML = '';

    const filtered = threads.filter(t => 
        t.content.toLowerCase().includes(filterText.toLowerCase()) ||
        t.username.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
        threadListEl.innerHTML = '<p style="text-align:center; color:var(--sub-text); padding: 20px;">該当するスレッドが見つかりませんでした。</p>';
        return;
    }

    const totalCount = threads.length;

    filtered.forEach((thread) => {
        const originalIndex = threads.findIndex(t => t.id === thread.id);
        const postNumber = totalCount - originalIndex;

        let imagesHtml = '';
        if (thread.images && thread.images.length > 0) {
            imagesHtml = '<div class="image-gallery">';
            thread.images.forEach(img => {
                imagesHtml += `<img src="${img}" onclick="window.open('${img}')" title="クリックして拡大">`;
            });
            imagesHtml += '</div>';
        }

        let repliesHtml = '';
        if (thread.replies && thread.replies.length > 0) {
            thread.replies.forEach(reply => {
                repliesHtml += `
                    <div class="reply-card">
                        <div class="reply-meta">
                            <span><strong>${escapeHTML(reply.username)}</strong></span>
                            <span>${reply.timestamp}</span>
                        </div>
                        <div>${escapeHTML(reply.content)}</div>
                    </div>
                `;
            });
        }

        const isOwner = (thread.username === currentUser.name);
        const ownerTagHtml = isOwner ? '<span class="owner-tag">あなたの投稿</span>' : '';
        const threadAvatar = thread.avatar || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=default';

        const card = document.createElement('div');
        card.className = 'thread-card';
        card.innerHTML = `
            <div class="post-header">
                <div class="post-author-info">
                    <img src="${threadAvatar}" class="avatar" alt="icon" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=default'">
                    <div class="post-meta">
                        <span class="username">${escapeHTML(thread.username)}</span>
                        <span class="timestamp">${thread.timestamp}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${ownerTagHtml}
                    <span class="post-number">No.${postNumber}</span>
                </div>
            </div>
            <div class="post-content">${escapeHTML(thread.content)}</div>
            ${imagesHtml}
            <div class="post-actions">
                <div class="action-btns-group">
                    <button class="action-btn" onclick="editThread(${thread.id}, '${escapeHTML(thread.username)}')">✏️ 編集</button>
                    <button class="action-btn delete" onclick="deleteThread(${thread.id}, '${escapeHTML(thread.username)}')">🗑️ 削除</button>
                </div>
                <span style="font-size: 0.75rem; color: var(--sub-text);">ID: ${thread.id}</span>
            </div>
            <div class="replies-section">
                ${repliesHtml}
                <div class="reply-form">
                    <input type="text" id="replyInput_${thread.id}" placeholder="返信を入力...">
                    <button onclick="addReply(${thread.id})">返信</button>
                </div>
            </div>
        `;
        threadListEl.appendChild(card);
    });
}

// 検索フィルター
function filterPosts() {
    const query = document.getElementById('searchInput').value;
    renderThreads(query);
}

// 編集処理
function editThread(id, threadAuthor) {
    const thread = threads.find(t => t.id === id);
    if (!thread) return;

    if (threadAuthor !== currentUser.name) {
        const inputCode = prompt('この記事はあなたの投稿ではありません。\n編集するには管理者コードを入力してください：');
        if (inputCode !== MASTER_ADMIN_CODE) {
            if (inputCode !== null) alert('管理者コードが違うため、編集できません。');
            return;
        }
    }

    const newContent = prompt('投稿内容を編集してください:', thread.content);
    if (newContent !== null) {
        thread.content = newContent;
        saveAndRender();
        alert('投稿を更新しました！');
    }
}

// 削除処理
function deleteThread(id, threadAuthor) {
    const thread = threads.find(t => t.id === id);
    if (!thread) return;

    if (threadAuthor !== currentUser.name) {
        const inputCode = prompt('この記事はあなたの投稿ではありません。\n削除するには管理者コードを入力してください：');
        if (inputCode !== MASTER_ADMIN_CODE) {
            if (inputCode !== null) alert('管理者コードが違うため、削除できません。');
            return;
        }
    }

    if (confirm('このスレッドを削除してもよろしいですか？')) {
        threads = threads.filter(t => t.id !== id);
        saveAndRender();
    }
}

// 返信追加処理
function addReply(threadId) {
    const inputEl = document.getElementById(`replyInput_${threadId}`);
    const text = inputEl.value.trim();
    if (!text) return;

    const thread = threads.find(t => t.id === threadId);
    if (thread) {
        thread.replies.push({
            id: Date.now(),
            username: currentUser.name,
            content: text,
            timestamp: getNowDate()
        });
        saveAndRender();
        inputEl.value = '';
    }
}

// 保存して再描画
function saveAndRender() {
    saveThreadsData();
    filterPosts();
}

// HTMLエスケープ処理
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
