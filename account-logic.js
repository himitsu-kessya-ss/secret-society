// ==========================================
// アカウントページ用 処理ロジックファイル (B案対応)
// ==========================================

window.onload = function() {
    // 1. まず通常のログインチェック
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        alert('ログインセッションが切れました。ログインしてください。');
        window.location.href = 'index.html';
        return;
    }

    // 2. 既にこのブラウザセッションで「管理者認証」が通っているか確認
    if (sessionStorage.getItem('isAdminUnlocked') === 'true') {
        unlockPageContent();
    } else {
        // まだならオーバーレイ（ロック画面）を表示したままにする
        document.getElementById('auth-overlay').style.display = 'flex';
        document.getElementById('protected-content').style.display = 'none';
    }
};

// ページ入室時の管理者パスワード検証処理
function verifyPageAdmin(event) {
    event.preventDefault();
    const inputPw = document.getElementById('page-admin-pw').value.trim();
    const errorMsg = document.getElementById('page-auth-error');

    if (inputPw === ADMIN_PASSWORD_SECRET) {
        errorMsg.style.display = 'none';
        sessionStorage.setItem('isAdminUnlocked', 'true');
        document.getElementById('page-admin-pw').value = '';
        unlockPageContent();
    } else {
        errorMsg.style.display = 'block';
    }
}

// 認証成功時にコンテンツをアンロックして表示する処理
function unlockPageContent() {
    // ロック画面を隠す
    document.getElementById('auth-overlay').style.display = 'none';
    // メインコンテンツを表示
    document.getElementById('protected-content').style.display = 'flex';

    // ログインIDの反映
    const loginUserId = sessionStorage.getItem('loginUserId') || 'secret';
    document.getElementById('display-id').textContent = loginUserId;

    // アカウント設定情報の読込
    let accountData = JSON.parse(localStorage.getItem('secret_user_account'));
    if (!accountData) {
        const defaultName = sessionStorage.getItem('loginUserName') || '管理人';
        accountData = {
            name: defaultName,
            avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + loginUserId
        };
        localStorage.setItem('secret_user_account', JSON.stringify(accountData));
    }

    document.getElementById('input-name').value = accountData.name || '';
    document.getElementById('input-avatar').value = accountData.avatar || '';
    updateAvatarPreview(accountData.avatar);
}

// アバターのプレビュー更新
function updateAvatarPreview(url) {
    const previewBox = document.getElementById('avatar-preview-box');
    if (url && url.trim() !== '') {
        previewBox.innerHTML = `<img src="${url}" alt="Avatar" onerror="this.onerror=null; this.parentNode.innerHTML='👤';">`;
    } else {
        previewBox.innerHTML = '👤';
    }
}

// 入力時にリアルタイムプレビュー
document.addEventListener('DOMContentLoaded', () => {
    const avatarInput = document.getElementById('input-avatar');
    if (avatarInput) {
        avatarInput.addEventListener('input', function(e) {
            updateAvatarPreview(e.target.value);
        });
    }
});

// アカウント設定保存処理
function saveAccountSettings(event) {
    event.preventDefault();
    const newName = document.getElementById('input-name').value.trim();
    const newAvatar = document.getElementById('input-avatar').value.trim();

    const accountData = { name: newName, avatar: newAvatar };
    localStorage.setItem('secret_user_account', JSON.stringify(accountData));
    sessionStorage.setItem('loginUserName', newName);

    const msg = document.getElementById('save-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

// ロックして退出（管理者セッションを消してトップやロック画面に戻る）
function lockAndExit() {
    sessionStorage.removeItem('isAdminUnlocked');
    window.location.href = 'index.html#main';
}

function logout() {
    if (confirm('ログアウトしますか？')) {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}
