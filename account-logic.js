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

    if (sessionStorage.getItem('isAdminUnlocked') === 'true') {
        unlockPageContent();
    } else {
        document.getElementById('auth-overlay').style.display = 'flex';
        document.getElementById('protected-content').style.display = 'none';
    }
};

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

function unlockPageContent() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('protected-content').style.display = 'block';
    loadAccountList();
}

function getCurrentFormattedDate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getStoredAccounts() {
    let accounts = JSON.parse(localStorage.getItem('secret_managed_accounts'));
    if (!accounts) {
        accounts = INITIAL_ACCOUNTS;
        localStorage.setItem('secret_managed_accounts', JSON.stringify(accounts));
    }
    return accounts;
}

// 一覧テーブルを描画（並び順：ID, PW, キャラ名, 権限, メモ, 最終更新日）
function loadAccountList() {
    const accounts = getStoredAccounts();
    const tbody = document.getElementById('account-list-tbody');
    tbody.innerHTML = '';

    accounts.forEach((acc, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${acc.id}</strong></td>
            <td><input type="text" id="pw-${index}" value="${acc.pw}"></td>
            <td><input type="text" id="chara-${index}" value="${acc.charaName || ''}"></td>
            <td>
                <select id="role-${index}">
                    <option value="一般" ${acc.role === '一般' ? 'selected' : ''}>一般</option>
                    <option value="管理者" ${acc.role === '管理者' ? 'selected' : ''}>管理者</option>
                    <option value="ゲスト" ${acc.role === 'ゲスト' ? 'selected' : ''}>ゲスト</option>
                </select>
            </td>
            <td><input type="text" id="memo-${index}" value="${acc.memo || ''}"></td>
            <td style="font-size: 0.75rem; color: var(--sub-text); white-space: nowrap;">${acc.updated || '--'}</td>
            <td>
                <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="updateAccount(${index})">保存</button>
                    <button type="button" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteAccount(${index})">削除</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 新規アカウント発行
function createAccount(event) {
    event.preventDefault();
    const newId = document.getElementById('new-id').value.trim();
    const newPw = document.getElementById('new-pw').value.trim();
    const newChara = document.getElementById('new-charaname').value.trim();
    const newRole = document.getElementById('new-role').value;
    const newMemo = document.getElementById('new-memo').value.trim();

    let accounts = getStoredAccounts();

    if (accounts.some(acc => acc.id === newId)) {
        alert('エラー: すでに存在するアカウントIDです。');
        return;
    }

    accounts.push({
        id: newId,
        pw: newPw,
        charaName: newChara,
        role: newRole,
        memo: newMemo,
        updated: getCurrentFormattedDate()
    });

    localStorage.setItem('secret_managed_accounts', JSON.stringify(accounts));

    document.getElementById('create-account-form').reset();
    loadAccountList();
    alert(`アカウント「${newId}」を発行しました！`);
}

// 既存アカウントの編集・保存
function updateAccount(index) {
    let accounts = getStoredAccounts();
    const pwInput = document.getElementById(`pw-${index}`).value.trim();
    const charaInput = document.getElementById(`chara-${index}`).value.trim();
    const roleInput = document.getElementById(`role-${index}`).value;
    const memoInput = document.getElementById(`memo-${index}`).value.trim();

    if (!pwInput) {
        alert('パスワードを空にはできません。');
        return;
    }

    accounts[index].pw = pwInput;
    accounts[index].charaName = charaInput;
    accounts[index].role = roleInput;
    accounts[index].memo = memoInput;
    accounts[index].updated = getCurrentFormattedDate();

    localStorage.setItem('secret_managed_accounts', JSON.stringify(accounts));
    loadAccountList();
    alert(`アカウント「${accounts[index].id}」の設定を保存しました！`);
}

// アカウント削除
function deleteAccount(index) {
    let accounts = getStoredAccounts();
    const targetId = accounts[index].id;

    if (confirm(`本当にアカウント「${targetId}」を削除しますか？`)) {
        accounts.splice(index, 1);
        localStorage.setItem('secret_managed_accounts', JSON.stringify(accounts));
        loadAccountList();
    }
}

function lockAndExit() {
    sessionStorage.removeItem('isAdminUnlocked');
    window.location.href = 'index.html#main';
}

function logout() {
    if (confirm('完全ログアウトしますか？')) {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}
