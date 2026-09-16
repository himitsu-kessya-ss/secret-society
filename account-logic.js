// ==========================================
// アカウントページ用 処理ロジックファイル
// ==========================================

window.onload = function() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        alert('ログインセッションが切れました。ログインしてください。');
        window.location.href = 'index.html';
        return;
    }

    // ログインIDの表示
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

    // 既に管理者セッションが通っているかチェック
    if (sessionStorage.getItem('isAdminUnlocked') === 'true') {
        showAdminUnlocked();
    }
};

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

// 管理者認証の検証処理
function verifyAdmin(event) {
    event.preventDefault();
    const inputPw = document.getElementById('admin-pw').value.trim();
    const errorMsg = document.getElementById('admin-error');

    if (inputPw === ADMIN_PASSWORD_SECRET) {
        errorMsg.style.display = 'none';
        sessionStorage.setItem('isAdminUnlocked', 'true');
        showAdminUnlocked();
        document.getElementById('admin-pw').value = '';
    } else {
        errorMsg.style.display = 'block';
    }
}

function showAdminUnlocked() {
    document.getElementById('admin-locked-view').style.display = 'none';
    document.getElementById('admin-unlocked-view').style.display = 'block';
}

function lockAdmin() {
    sessionStorage.removeItem('isAdminUnlocked');
    document.getElementById('admin-unlocked-view').style.display = 'none';
    document.getElementById('admin-locked-view').style.display = 'block';
}

function logout() {
    if (confirm('ログアウトしますか？')) {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}
