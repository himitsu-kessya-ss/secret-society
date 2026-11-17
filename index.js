// --- 複数ユーザーの定義（セキュリティ向上のため、パスワードはSHA-256ハッシュで保持） ---
// ※元のパスワード：
// "secret" （管理人） -> パスワード: "12342234"
// "pilot1" （パイロットA） -> パスワード: "abcd1234"
const VALID_USERS = [
    { 
        id: "secret", 
        pwHash: "b2184d09252bc1946cff015a995e8fb85c5c16353d9e57fcff1763ef873523f2", 
        name: "管理人" 
    },
    { 
        id: "pilot1", 
        pwHash: "e4d7d3d4b68e07831f2fa10e71b29a2e6f3b0e3523315729d7d10da77626e255", 
        name: "パイロットA" 
    }
];

// 連続失敗の制限設定（ブルートフォース対策）
const MAX_ATTEMPTS = 3;           // 最大失敗回数
const LOCK_TIME_SEC = 30;         // ロック時間（秒）

// パスワードをSHA-256でハッシュ化する関数
async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ログイン処理
async function handleLogin(event) {
    event.preventDefault();
    
    const idInput = document.getElementById('username').value.trim();
    const pwInput = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('error-msg');
    const enterBtn = document.getElementById('enter-btn'); // 認証ボタン

    // ロック中かどうかのチェック
    const lockUntil = localStorage.getItem("lockUntil");
    if (lockUntil && Date.now() < parseInt(lockUntil)) {
        const remaining = Math.ceil((parseInt(lockUntil) - Date.now()) / 1000);
        errorMsg.style.display = 'block';
        errorMsg.textContent = `連続失敗のためロック中です。あと ${remaining} 秒お待ちください。`;
        return;
    }

    // 入力されたパスワードをハッシュ化して照合
    const hashedInputPw = await hashPassword(pwInput);
    const matchedUser = VALID_USERS.find(user => user.id === idInput && user.pwHash === hashedInputPw);

    if (matchedUser) {
        // 成功：失敗回数・ロック情報をリセット
        localStorage.removeItem("loginAttempts");
        localStorage.removeItem("lockUntil");

        errorMsg.style.display = 'none';
        
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('loginUserId', matchedUser.id);
        sessionStorage.setItem('loginUserName', matchedUser.name);
        
        if (!localStorage.getItem('secret_user_account')) {
            localStorage.setItem('secret_user_account', JSON.stringify({
                name: matchedUser.name,
                avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + matchedUser.id
            }));
        }

        goToMain();
    } else {
        // 失敗：試行回数をカウントアップ
        let attempts = parseInt(localStorage.getItem("loginAttempts") || "0") + 1;
        localStorage.setItem("loginAttempts", attempts);

        if (attempts >= MAX_ATTEMPTS) {
            const unlockTime = Date.now() + (LOCK_TIME_SEC * 1000);
            localStorage.setItem("lockUntil", unlockTime);
            errorMsg.style.display = 'block';
            errorMsg.textContent = `3回連続で失敗しました。${LOCK_TIME_SEC}秒間ロックされます。`;
            if (enterBtn) enterBtn.disabled = true;
            
            setTimeout(() => {
                localStorage.removeItem("loginAttempts");
                localStorage.removeItem("lockUntil");
                errorMsg.style.display = 'none';
                if (enterBtn) enterBtn.disabled = false;
            }, LOCK_TIME_SEC * 1000);
        } else {
            errorMsg.style.display = 'block';
            errorMsg.textContent = `IDまたはパスワードが正しくありません（残り試行回数: ${MAX_ATTEMPTS - attempts}回）`;
        }
    }
}

// ロック状態の復元チェック
function checkLockoutStatus() {
    const lockUntil = localStorage.getItem("lockUntil");
    const enterBtn = document.getElementById('enter-btn');
    const errorMsg = document.getElementById('error-msg');

    if (lockUntil && Date.now() < parseInt(lockUntil)) {
        const remaining = Math.ceil((parseInt(lockUntil) - Date.now()) / 1000);
        if (enterBtn) enterBtn.disabled = true;
        if (errorMsg) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = `ロック中です。あと ${remaining} 秒お待ちください。`;
        }

        setTimeout(() => {
            localStorage.removeItem("loginAttempts");
            localStorage.removeItem("lockUntil");
            if (errorMsg) errorMsg.style.display = 'none';
            if (enterBtn) enterBtn.disabled = false;
        }, remaining * 1000);
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    // index.htmlのヘッダーコンテナ、または読み込まれたheader要素を取得
    const headerContainer = document.getElementById('header-container');
    const header = headerContainer ? headerContainer.querySelector('header') || headerContainer : document.getElementById('main-header');
    const secretCard = document.getElementById('secret-card');

    if (pageId === 'main-page') {
        if (header) header.style.display = 'flex';
        
        setTimeout(() => {
            if (secretCard) {
                secretCard.style.display = 'flex';
                setTimeout(() => {
                    secretCard.style.opacity = '1';
                    secretCard.style.transform = 'translateY(0)';
                }, 50);
            }
        }, 10000);

    } else {
        if (header) header.style.display = 'none';
        if (secretCard) {
            secretCard.style.display = 'none';
            secretCard.style.opacity = '0';
            secretCard.style.transform = 'translateY(20px)';
        }
    }
    window.scrollTo(0, 0);
    
    if (window.goatcounter) goatcounter.count({ path: '/#' + pageId });
}

function goToMain() { 
    location.hash = "main"; 
    showPage('main-page'); 
}

function checkAuthAndRoute() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    // ページ読み込み時やハッシュ変更時にロック状態を確認
    checkLockoutStatus();
    
    if (window.location.hash === '#main') {
        if (isLoggedIn) {
            showPage('main-page');
        } else {
            location.hash = ""; 
            showPage('top-page');
        }
    } else {
        showPage('top-page');
    }
}

window.onload = checkAuthAndRoute;
window.onhashchange = checkAuthAndRoute;
