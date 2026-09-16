// ==========================================
// アカウント管理 - ロジック・機能スクリプト (account_logic.js)
// ==========================================

window.onload = function() {
    const loginUserId = sessionStorage.getItem('loginUserId') || 'secret';
    document.getElementById('current-login-id').textContent = loginUserId;

    // データファイルからアカウント情報を取得してフォームに反映
    const accountData = loadAccountData();
    document.getElementById('nameInput').value = accountData.name || '';
    document.getElementById('avatarInput').value = accountData.avatar || '';

    updatePreview();
};

// 顔アイコンのプレビューをリアルタイム更新
function updatePreview() {
    const avatarInputVal = document.getElementById('avatarInput').value.trim();
    const previewContainer = document.getElementById('preview-container');
    const loginUserId = sessionStorage.getItem('loginUserId') || 'secret';

    const defaultAvatar = 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + loginUserId;
    const targetAvatar = avatarInputVal !== '' ? avatarInputVal : defaultAvatar;

    previewContainer.innerHTML = `<img src="${targetAvatar}" alt="Avatar" onerror="this.onerror=null; this.parentNode.innerHTML='👤';">`;
}

// プロフィール（名前・顔アイコン）の保存処理
function saveProfileSettings() {
    const nameVal = document.getElementById('nameInput').value.trim();
    const avatarVal = document.getElementById('avatarInput').value.trim();

    if (!nameVal) {
        alert('プレイヤー名を入力してください。');
        return;
    }

    let accountData = loadAccountData();
    accountData.name = nameVal;
    accountData.avatar = avatarVal;

    saveAccountData(accountData);
    sessionStorage.setItem('loginUserName', nameVal); // セッション側も同期

    const successMsg = document.getElementById('profileSuccessMsg');
    successMsg.style.display = 'block';
    setTimeout(() => {
        successMsg.style.display = 'none';
    }, 3000);
}

// パスワード変更処理
function changePassword() {
    const currentPw = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newPassword').value;

    if (!currentPw || !newPw) {
        alert('現在のパスワードと新しいパスワードの両方を入力してください。');
        return;
    }

    let storedPassword = getStoredPassword();

    if (currentPw !== storedPassword) {
        alert('現在のパスワードが間違っています。');
        return;
    }

    if (newPw.length < 4) {
        alert('新しいパスワードは4文字以上で設定してください。');
        return;
    }

    setStoredPassword(newPw);

    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';

    const pwSuccessMsg = document.getElementById('pwSuccessMsg');
    pwSuccessMsg.style.display = 'block';
    setTimeout(() => {
        pwSuccessMsg.style.display = 'none';
    }, 3000);
}
