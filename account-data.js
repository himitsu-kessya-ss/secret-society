// ==========================================
// アカウント管理 - データ管理スクリプト (account_data.js)
// ==========================================

// アカウント情報の読み込み（なければ初期データをセット）
function loadAccountData() {
    const loginUserId = sessionStorage.getItem('loginUserId') || 'secret';
    const loginUserName = sessionStorage.getItem('loginUserName') || '名無しパイロット';
    
    let savedData = JSON.parse(localStorage.getItem('secret_user_account'));
    if (!savedData) {
        savedData = {
            name: loginUserName,
            avatar: ''
        };
        localStorage.setItem('secret_user_account', JSON.stringify(savedData));
    }
    return savedData;
}

// アカウント情報の保存
function saveAccountData(accountData) {
    localStorage.setItem('secret_user_account', JSON.stringify(accountData));
}

// パスワード情報の取得・保存
function getStoredPassword() {
    return localStorage.getItem('secret_user_password') || '12342234';
}

function setStoredPassword(newPw) {
    localStorage.setItem('secret_user_password', newPw);
}
