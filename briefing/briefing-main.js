// briefing/briefing-main.js

let currentEventId = null;
let targetEventIdForAdmin = null;
let currentTab = 'plan';
let MECHA_DB = {}; 
let mechaListArray = []; 
let editingRowIndex = null; 

const DEFAULT_REGULATION_TEMPLATE = `・レギュ
コスト１０５ 総ＨＰ８５０ｘ人数以下 能力５００固定 結社設置
コスト８５ 総ＨＰ５５０ｘ人数以下  能力フリー 星屑設置
リーダー無し団体戦術あり

禁止：同機体複数登録、ＬＡ、直撃、超龍神、武器庫産アトミックバズーカ
〇配慮要素：
 オールSS、ジャマーHP吸収セット
〇地形：
 設置側が選択`;

window.onload = async function() {
    localStorage.removeItem('secret_society_briefing_state_v3');
    showMainPage();

    await loadMechaCsv();
    await loadEventsFromServer(false); 
};

// 【レギュレーション表示描画】
function renderRegulationArea(ev) {
    const displayBox = document.getElementById('regulation-display-box');
    const editArea = document.getElementById('regulation-edit-textarea');
    const toggleBtn = document.getElementById('btn-toggle-reg-edit');
    const saveBtn = document.getElementById('btn-save-reg');

    if (!displayBox || !editArea) return;

    const regText = (ev && ev.regulation) ? ev.regulation : '';
    displayBox.textContent = regText ? regText : '（レギュレーション未設定 — 右上の「✏️ 編集する」から記入できます）';
    displayBox.style.color = regText ? '#e2e8f0' : 'var(--text-muted)';
    editArea.value = regText;

    displayBox.classList.remove('hidden');
    editArea.classList.add('hidden');
    if (toggleBtn) toggleBtn.textContent = '✏️ 編集する';
    if (saveBtn) saveBtn.classList.add('hidden');
}

// 【レギュレーション編集モード切替】
function toggleRegulationEditMode() {
    const displayBox = document.getElementById('regulation-display-box');
    const editArea = document.getElementById('regulation-edit-textarea');
    const toggleBtn = document.getElementById('btn-toggle-reg-edit');
    const saveBtn = document.getElementById('btn-save-reg');

    if (!displayBox || !editArea) return;

    const isEditing = !editArea.classList.contains('hidden');
    if (isEditing) {
        const ev = events.find(e => e.id === currentEventId);
        editArea.value = (ev && ev.regulation) ? ev.regulation : '';
        displayBox.classList.remove('hidden');
        editArea.classList.add('hidden');
        if (toggleBtn) toggleBtn.textContent = '✏️ 編集する';
        if (saveBtn) saveBtn.classList.add('hidden');
    } else {
        displayBox.classList.add('hidden');
        editArea.classList.remove('hidden');
        if (toggleBtn) toggleBtn.textContent = '✖ キャンセル';
        if (saveBtn) saveBtn.classList.remove('hidden');
        editArea.focus();
    }
}

// 【レギュレーションをサーバーへ保存】
async function saveRegulationToServer() {
    if (!GAS_URL || !currentEventId) return;

    const editArea = document.getElementById('regulation-edit-textarea');
    if (!editArea) return;
    const newRegText = editArea.value;

    await loadEventsFromServer(true);

    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    ev.regulation = newRegText;
    await saveAllEventsToServer();

    renderRegulationArea(ev);
    alert('レギュレーションをサーバーに保存しました！');
}

// 空の作戦行オブジェクトを生成するヘルパー
function createEmptyTacticsRow() {
    return {
        reg: false, sync: false, tactic: "AA", actualCost: 0, turn: 1, player: "", mecha: "", hp: 0, weapon: "", minR: 0, maxR: 20, equip: "", 
        strPre: "移動", strPost: "攻撃", 
        t1: "", l1: 0, t2: "", l2: 0, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
        c1:false, c2:false, c3:false, c4:false, c5:false, c6:false, c7:false, c8:false, r1:false, r2:false, r3:false
    };
}

// 【作戦立案タブ用】「更新対象」がONの行だけを反映して一括保存（新規追加行にも対応）
async function saveSelectedTacticsToServer() {
    if (!GAS_URL) return;

    const currentEvBeforeSync = events.find(e => e.id === currentEventId);
    if (!currentEvBeforeSync) return;

    const rows = document.querySelectorAll('#tbody-tactics tr');
    const pendingUpdates = [];

    rows.forEach((tr, idx) => {
        const syncCheckbox = tr.querySelector('.row-sync-checkbox');
        if (syncCheckbox && syncCheckbox.checked) {
            if (!currentEvBeforeSync.tactics[idx]) {
                currentEvBeforeSync.tactics[idx] = createEmptyTacticsRow();
            }
            collectRowDataFromDOM(idx, currentEvBeforeSync);
            const rowSnapshot = JSON.parse(JSON.stringify(currentEvBeforeSync.tactics[idx]));
            rowSnapshot.sync = false;
            pendingUpdates.push({ idx: idx, data: rowSnapshot });
        }
    });

    if (pendingUpdates.length === 0) {
        alert('「更新対象」にチェックが入っている行がありません。更新したい行のチェックボックスをONにしてください。');
        return;
    }

    await loadEventsFromServer(true);

    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    pendingUpdates.forEach(item => {
        while (ev.tactics.length <= item.idx) {
            ev.tactics.push(createEmptyTacticsRow());
        }
        ev.tactics[item.idx] = item.data;
    });

    const toggleAllHeader = document.getElementById('toggle-all-sync');
    if (toggleAllHeader) toggleAllHeader.checked = false;

    await saveAllEventsToServer();
    alert(`選択された ${pendingUpdates.length} 行の作戦データをサーバーに反映しました！`);
    renderTacticsTable(ev);
}

function toggleAllSyncCheckboxes(headerCheckbox) {
    const isChecked = headerCheckbox.checked;
    const rows = document.querySelectorAll('#tbody-tactics tr');
    const ev = events.find(e => e.id === currentEventId);

    rows.forEach((tr, idx) => {
        const syncCheckbox = tr.querySelector('.row-sync-checkbox');
        if (syncCheckbox) {
            syncCheckbox.checked = isChecked;
        }
        if (ev && ev.tactics[idx]) {
            ev.tactics[idx].sync = isChecked;
        }
    });
}

// メンバーが「出場」有効かどうかを判定（旧データ互換のため未定義時はtrue扱い）
function isMemberActive(memberObj) {
    if (!memberObj) return false;
    return memberObj.active !== false;
}

// 参加メンバー表のDOMから状態（出場チェック・名前・熟練度・階級）を収集
function collectMembersFromDOM(ev) {
    const memberRows = document.querySelectorAll('#tbody-members tr');
    let newMembersObj = {};

    memberRows.forEach(tr => {
        const activeCb = tr.querySelector('.member-active-checkbox');
        const nameInput = tr.querySelector('.member-name-input');
        const expInput = tr.querySelector('.member-exp-input');
        const rankSelect = tr.querySelector('.member-rank-select');
        if (nameInput && nameInput.value.trim()) {
            const pName = nameInput.value.trim();
            newMembersObj[pName] = {
                active: activeCb ? activeCb.checked : true,
                exp: Number(expInput ? expInput.value : 100),
                rank: rankSelect ? rankSelect.value : '一等兵'
            };
        }
    });
    ev.members = newMembersObj;
}

// 【追加】画面上のメンバーを全削除する（保存ボタンを押すまではサーバーに反映されない）
function clearAllMembers() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    const currentCount = Object.keys(ev.members || {}).length;
    if (currentCount === 0) {
        alert('削除するメンバーがいません。');
        return;
    }

    if (!confirm(`画面上のメンバー（${currentCount}名）をすべて削除しますか？\n※「💾 メンバー情報をサーバーに保存」を押すまでサーバーには確定しません。`)) {
        return;
    }

    ev.members = {};
    renderMemberTable(ev);
    renderTacticsTable(ev);
}

// メンバー取込ボックスの開閉
function toggleMemberImportArea() {
    const box = document.getElementById('member-import-box');
    const textarea = document.getElementById('member-import-textarea');
    if (!box) return;
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden') && textarea) {
        textarea.focus();
    }
}

// 勢力所属メンバー一覧コピペテキストから「プレイヤー名・熟練度・階級」を抽出して一括取込
function importMembersFromPaste() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    const textarea = document.getElementById('member-import-textarea');
    const rawText = textarea ? textarea.value : '';
    if (!rawText.trim()) {
        alert('貼り付け欄が空です。勢力所属メンバー一覧のテキストを貼り付けてください。');
        return;
    }

    collectMembersFromDOM(ev);

    const rankKeys = Object.keys(RANK_MASTER);
    const sortedRanks = [...rankKeys].sort((a, b) => b.length - a.length);
    const rankPattern = sortedRanks.map(r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const rankExpRegex = new RegExp(`(${rankPattern})\\s+(\\d+)`);

    const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
    const parsedMembers = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/^【.+】$/.test(line) && i + 1 < lines.length) {
            const candidateName = lines[i + 1].trim();
            if (candidateName && !candidateName.startsWith('貢献ポイント') && !/^\d+$/.test(candidateName)) {
                let foundRank = '一等兵';
                let foundExp = 100;

                for (let j = i + 2; j <= Math.min(i + 8, lines.length - 1); j++) {
                    if (/^【.+】$/.test(lines[j])) break;

                    const match = lines[j].match(rankExpRegex);
                    if (match) {
                        foundRank = match[1];
                        foundExp = Number(match[2]);
                        break;
                    }
                }

                parsedMembers.push({
                    name: candidateName,
                    rank: foundRank,
                    exp: foundExp
                });
            }
        }
    }

    if (parsedMembers.length === 0) {
        alert('メンバー情報を読み取れませんでした。\n「【称号】」と「階級・熟練度」が含まれるように勢力所属メンバー一覧をコピーして貼り付けてください。');
        return;
    }

    let addedCount = 0;
    let updatedCount = 0;

    parsedMembers.forEach(m => {
        if (ev.members[m.name]) {
            ev.members[m.name].exp = m.exp;
            ev.members[m.name].rank = m.rank;
            updatedCount++;
        } else {
            ev.members[m.name] = {
                active: false,
                exp: m.exp,
                rank: m.rank
            };
            addedCount++;
        }
    });

    renderMemberTable(ev);
    renderTacticsTable(ev);

    if (textarea) textarea.value = '';
    const box = document.getElementById('member-import-box');
    if (box) box.classList.add('hidden');

    alert(`勢力メンバー ${parsedMembers.length} 名を取り込みました！（新規: ${addedCount} 名 / 更新: ${updatedCount} 名）\n出場するメンバーにチェックを入れて「💾 メンバー情報をサーバーに保存」を押してください。`);
}

// 出場チェック全選択／全解除
function toggleAllMemberActive(headerCheckbox) {
    const isChecked = headerCheckbox.checked;
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    collectMembersFromDOM(ev);
    Object.keys(ev.members).forEach(pName => {
        ev.members[pName].active = isChecked;
    });

    renderMemberTable(ev);
    renderTacticsTable(ev);
}

// 個別の出場チェック変更時
function onMemberActiveChange() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;
    collectMembersFromDOM(ev);
    updateMemberCountDisplay(ev);
    renderTacticsTable(ev);
}

// 階級変更時に加算コスト表示と作戦表を即反映
function onMemberRankChange() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;
    collectMembersFromDOM(ev);
    renderMemberTable(ev);
    renderTacticsTable(ev);
}

function updateMemberCountDisplay(ev) {
    const names = Object.keys(ev.members);
    const activeCount = names.filter(p => isMemberActive(ev.members[p])).length;
    const activeEl = document.getElementById('member-active-count');
    const totalEl = document.getElementById('member-total-count');
    const toggleAllEl = document.getElementById('toggle-all-members');

    if (activeEl) activeEl.textContent = activeCount;
    if (totalEl) totalEl.textContent = names.length;
    if (toggleAllEl) {
        toggleAllEl.checked = names.length > 0 && activeCount === names.length;
    }
}

async function saveMembersToServer() {
    if (!GAS_URL) return;
    const currentEv = events.find(e => e.id === currentEventId);
    if (!currentEv) return;

    collectMembersFromDOM(currentEv);
    const membersSnapshot = JSON.parse(JSON.stringify(currentEv.members));

    await loadEventsFromServer(true);

    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    ev.members = membersSnapshot;
    
    await saveAllEventsToServer();
    alert('参加メンバー・階級情報をサーバーに保存しました！');
    renderMemberTable(ev);
    renderTacticsTable(ev);
}

function initDefaultEventData(ev) {
    DEFAULT_PLAYERS.forEach((p, idx) => {
        ev.members[p] = { active: true, exp: 150 + idx * 10, rank: "曹長" };
    });
    ev.members["Oro🍊min"] = { active: true, exp: 294, rank: "特務准尉" };
    ev.members["Halbert"] = { active: true, exp: 265, rank: "先任曹長" };

    ev.tactics = [
        { reg: true, sync: false, tactic: "DA", actualCost: 38, turn: 10, player: "Oro🍊min", mecha: "ガンダム", hp: 501, weapon: "★フルバースト", minR: 20, maxR: 70, equip: "プロペラントタンク", strPre: "移動しない", strPost: "攻撃", 
          t1: "集中", l1: 10, t2: "機転", l2: 10, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
          c1:false, c2:false, c3:false, c4:false, c5:false, c6:false, c7:false, c8:false, r1:false, r2:false, r3:false },
        { reg: true, sync: false, tactic: "DA", actualCost: 72, turn: 1, player: "Yggdrasill", mecha: "ガリルナガン", hp: 696, weapon: "アキシオン・アッシャー", minR: 50, maxR: 90, equip: "プロペラントタンク", strPre: "足止め", strPost: "回避", 
          t1: "集中", l1: 10, t2: "繊細", l2: 10, t3: "偵察", l3: 7, t4: "", l4: 0, t5: "", l5: 0, 
          c1:false, c2:false, c3:false, c4:false, c5:false, c6:false, c7:false, c8:false, r1:false, r2:false, r3:false }
    ];
}

// イベント一覧カードの描画
function renderEventList() {
    const listEl = document.getElementById('event-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    events.forEach((ev, index) => {
        const card = document.createElement('div');
        card.className = 'event-card';
        
        const hasPass = ev.pass !== undefined && ev.pass !== null && ev.pass !== "";
        const lockText = hasPass ? '🔒 要パスワード保護' : '🔓 パスワードなし';
        const eventNo = index + 1;

        let datesHtml = '';
        if (ev.scheduleDate || ev.actualDate) {
            datesHtml += `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap;">`;
            if (ev.scheduleDate) {
                datesHtml += `<span>📅 予定: <strong style="color: #fff;">${ev.scheduleDate}</strong></span>`;
            }
            if (ev.actualDate) {
                datesHtml += `<span>🎯 開催: <strong style="color: var(--accent);">${ev.actualDate}</strong></span>`;
            }
            datesHtml += `</div>`;
        }

        card.innerHTML = `
            <div onclick="handleEventCardClick('${ev.id}')" style="cursor: pointer;">
                <div style="font-size: 0.8rem; color: var(--accent); margin-bottom: 4px; font-weight: bold;">No. ${eventNo}</div>
                <h3>${ev.title}</h3>
                ${datesHtml}
                <p class="sub-title" style="margin-top:8px;">${lockText}</p>
            </div>
            <button class="btn btn-secondary" style="position: absolute; top: 15px; right: 15px; padding: 4px 10px; font-size: 0.75rem;" onclick="openAdminSettingsModal(event, '${ev.id}')">⚙️ 管理設定</button>
        `;
        listEl.appendChild(card);
    });
}

function handleEventCardClick(evId) {
    const ev = events.find(e => e.id === evId);
    if (!ev) return;

    if (!ev.pass) {
        loadEventSheet(ev);
    } else {
        openAuthModal(evId);
    }
}

function showMainPage() {
    document.getElementById('page-briefing-room').classList.remove('hidden');
    document.getElementById('page-event-sheet').classList.add('hidden');
    document.getElementById('btn-back-main').classList.add('hidden');
    document.getElementById('global-sync-controls').classList.add('hidden');
    currentEventId = null;
    loadEventsFromServer(false);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-create').classList.add('hidden');
    document.getElementById('modal-bulk-auth').classList.add('hidden');
    document.getElementById('modal-bulk-edit').classList.add('hidden');
    document.getElementById('modal-auth').classList.add('hidden');
    document.getElementById('modal-admin-settings').classList.add('hidden');
    document.getElementById('modal-mecha-search').classList.add('hidden');
}

function openBulkAuthModal() {
    const pwInput = document.getElementById('input-bulk-auth-pw');
    if (pwInput) {
        pwInput.value = '';
    }
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-bulk-auth').classList.remove('hidden');
    if (pwInput) {
        setTimeout(() => pwInput.focus(), 50);
    }
}

async function submitBulkAuth() {
    const adminPw = document.getElementById('input-bulk-auth-pw').value;
    if (adminPw !== 'p@ssw0rd') {
        alert('管理者パスワードが正しくありません。');
        return;
    }

    closeModal();
    await openBulkEditModal();
}

async function openBulkEditModal() {
    await loadEventsFromServer(true);

    const container = document.getElementById('bulk-edit-container');
    container.innerHTML = '';

    events.forEach((ev, idx) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = "background: var(--bg-main); padding: 10px; border-radius: 6px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px;";
        itemDiv.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--accent); font-weight: bold;">No. ${idx + 1} (ID: ${ev.id})</div>
            <div style="display: flex; gap: 8px;">
                <input type="text" class="bulk-title-input" data-id="${ev.id}" value="${ev.title}" placeholder="イベント名" style="flex: 2;">
                <input type="text" class="bulk-pass-input" data-id="${ev.id}" value="${ev.pass || ''}" placeholder="パスワード(空欄可)" style="flex: 1;">
            </div>
            <div style="display: flex; gap: 8px;">
                <input type="text" class="bulk-sched-input" data-id="${ev.id}" value="${ev.scheduleDate || ''}" placeholder="開催予定日 (例: 2026/11/20)" style="flex: 1;">
                <input type="text" class="bulk-date-input" data-id="${ev.id}" value="${ev.actualDate || ''}" placeholder="開催日 (例: 2026/11/25)" style="flex: 1;">
            </div>
        `;
        container.appendChild(itemDiv);
    });

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-bulk-edit').classList.remove('hidden');
}

async function submitBulkEdit() {
    const container = document.getElementById('bulk-edit-container');

    const draftMap = {};
    events.forEach(ev => {
        const titleInput = container.querySelector(`.bulk-title-input[data-id="${ev.id}"]`);
        const passInput = container.querySelector(`.bulk-pass-input[data-id="${ev.id}"]`);
        const schedInput = container.querySelector(`.bulk-sched-input[data-id="${ev.id}"]`);
        const dateInput = container.querySelector(`.bulk-date-input[data-id="${ev.id}"]`);

        draftMap[ev.id] = {
            title: titleInput ? titleInput.value : ev.title,
            pass: passInput ? passInput.value : (ev.pass || ''),
            scheduleDate: schedInput ? schedInput.value : (ev.scheduleDate || ''),
            actualDate: dateInput ? dateInput.value : (ev.actualDate || '')
        };
    });

    await loadEventsFromServer(true);

    events.forEach(ev => {
        if (draftMap[ev.id]) {
            ev.title = draftMap[ev.id].title;
            ev.pass = draftMap[ev.id].pass;
            ev.scheduleDate = draftMap[ev.id].scheduleDate;
            ev.actualDate = draftMap[ev.id].actualDate;
        }
    });

    await saveAllEventsToServer();

    renderEventList();
    closeModal();
    alert('すべてのイベント情報を一括更新しました！');
}

function openCreateModal() {
    document.getElementById('input-admin-pw').value = '';
    document.getElementById('input-event-title').value = '';
    document.getElementById('input-event-sched').value = '';
    document.getElementById('input-event-date').value = '';
    document.getElementById('input-event-pw').value = '';
    document.getElementById('input-no-pass-check').checked = false;
    document.getElementById('input-event-pw').disabled = false;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-create').classList.remove('hidden');
}

function toggleCreatePassInput(checkbox) {
    const pwInput = document.getElementById('input-event-pw');
    pwInput.disabled = checkbox.checked;
    if (checkbox.checked) pwInput.value = '';
}

async function submitCreateEvent() {
    const adminPw = document.getElementById('input-admin-pw').value;
    const title = document.getElementById('input-event-title').value;
    const schedDate = document.getElementById('input-event-sched').value;
    const actualDate = document.getElementById('input-event-date').value;
    const noPass = document.getElementById('input-no-pass-check').checked;
    const eventPw = document.getElementById('input-event-pw').value;

    if (adminPw !== 'p@ssw0rd') {
        alert('管理者パスワードが正しくありません。');
        return;
    }
    if (!title) {
        alert('イベント名を入力してください。');
        return;
    }
    if (!noPass && !eventPw) {
        alert('入室パスワードを入力するか、「入室パスワードを不要にする」にチェックを入れてください。');
        return;
    }

    await loadEventsFromServer(true);

    const newEv = {
        id: 'ev_' + Date.now(),
        title: title,
        scheduleDate: schedDate,
        actualDate: actualDate,
        pass: noPass ? "" : eventPw,
        regulation: DEFAULT_REGULATION_TEMPLATE,
        members: {},
        tactics: []
    };
    initDefaultEventData(newEv);

    events.push(newEv);
    await saveAllEventsToServer();
    
    renderEventList();
    closeModal();
    alert('新規イベントを起票しました！');
}

function openAuthModal(evId) {
    currentEventId = evId;
    const ev = events.find(e => e.id === evId);
    document.getElementById('auth-event-title').innerText = ev.title;
    document.getElementById('input-auth-pw').value = '';
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-auth').classList.remove('hidden');
}

function submitAuthEvent() {
    const inputPw = document.getElementById('input-auth-pw').value;
    const ev = events.find(e => e.id === currentEventId);

    if (ev && (inputPw === ev.pass || inputPw === 'p@ssw0rd')) {
        closeModal();
        loadEventSheet(ev);
    } else {
        alert('パスワードが正しくありません。');
    }
}

function openAdminSettingsModal(eventObj, evId) {
    eventObj.stopPropagation();
    targetEventIdForAdmin = evId;
    const ev = events.find(e => e.id === evId);

    document.getElementById('admin-settings-title').innerText = `管理設定: ${ev.title}`;
    document.getElementById('input-mgr-admin-pw').value = '';
    document.getElementById('input-mgr-event-title').value = ev.title;
    document.getElementById('input-mgr-event-sched').value = ev.scheduleDate || '';
    document.getElementById('input-mgr-event-date').value = ev.actualDate || '';
    document.getElementById('input-mgr-new-pw').value = ev.pass || '';
    
    const noPassCheck = document.getElementById('input-mgr-no-pass');
    noPassCheck.checked = !ev.pass;
    document.getElementById('input-mgr-new-pw').disabled = !ev.pass;

    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-admin-settings').classList.remove('hidden');
}

function toggleMgrPassInput(checkbox) {
    const newPwInput = document.getElementById('input-mgr-new-pw');
    newPwInput.disabled = checkbox.checked;
    if (checkbox.checked) newPwInput.value = '';
}

async function submitAdminSettings() {
    const adminPw = document.getElementById('input-mgr-admin-pw').value;
    if (adminPw !== 'p@ssw0rd') {
        alert('管理者パスワードが正しくありません。');
        return;
    }

    const newTitle = document.getElementById('input-mgr-event-title').value;
    const schedDate = document.getElementById('input-mgr-event-sched').value;
    const actualDate = document.getElementById('input-mgr-event-date').value;
    const noPass = document.getElementById('input-mgr-no-pass').checked;
    const newPw = document.getElementById('input-mgr-new-pw').value;

    if (!newTitle) {
        alert('イベント名を入力してください。');
        return;
    }
    if (!noPass && !newPw) {
        alert('新しい入室パスワードを入力するか、「パスワードなしにする」にチェックを入れてください。');
        return;
    }

    await loadEventsFromServer(true);

    const ev = events.find(e => e.id === targetEventIdForAdmin);
    if (!ev) {
        alert('対象のイベントが見つかりませんでした。');
        renderEventList();
        closeModal();
        return;
    }

    ev.title = newTitle;
    ev.scheduleDate = schedDate;
    ev.actualDate = actualDate;
    ev.pass = noPass ? "" : newPw;

    await saveAllEventsToServer();
    
    renderEventList();
    closeModal();
    alert('イベント管理設定を更新しました！');
}

async function executeDeleteEvent() {
    const adminPw = document.getElementById('input-mgr-admin-pw').value;
    if (adminPw !== 'p@ssw0rd') {
        alert('管理者パスワードが正しくありません。');
        return;
    }

    await loadEventsFromServer(true);

    const ev = events.find(e => e.id === targetEventIdForAdmin);
    if (!ev) return;

    if (!confirm(`本当にイベント「${ev.title}」を削除しますか？この操作は元に戻せません。`)) {
        return;
    }

    events = events.filter(e => e.id !== targetEventIdForAdmin);
    await saveAllEventsToServer();

    renderEventList();
    closeModal();
    alert('イベントを削除しました。');
}

function loadEventSheet(ev) {
    currentEventId = ev.id;

    document.getElementById('page-briefing-room').classList.add('hidden');
    document.getElementById('page-event-sheet').classList.remove('hidden');
    document.getElementById('btn-back-main').classList.remove('hidden');
    document.getElementById('global-sync-controls').classList.remove('hidden');

    document.getElementById('sheet-event-title').innerText = ev.title;
    document.getElementById('sheet-event-desc').innerText = `イベントID: ${ev.id} | 全件同期モード`;

    renderRegulationArea(ev);
    renderMemberTable(ev);
    renderTacticsTable(ev);
    switchTab('plan');
}

function switchTab(tabName) {
    if (currentTab === 'member' && currentEventId) {
        const ev = events.find(e => e.id === currentEventId);
        if (ev) collectMembersFromDOM(ev);
    }

    currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    if (tabName === 'plan') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tab-plan').classList.remove('hidden');
        const ev = events.find(e => e.id === currentEventId);
        if (ev) renderTacticsTable(ev);
    } else if (tabName === 'member') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tab-member').classList.remove('hidden');
        const ev = events.find(e => e.id === currentEventId);
        if (ev) renderMemberTable(ev);
    } else if (tabName === 'summary') {
        document.querySelectorAll('.tab-btn')[2].classList.add('active');
        document.getElementById('tab-summary').classList.remove('hidden');
        renderSummaryCards();
    }
}

function renderMemberTable(ev) {
    const tbody = document.getElementById('tbody-members');
    tbody.innerHTML = '';

    Object.keys(ev.members).forEach(pName => {
        const m = ev.members[pName];
        const active = isMemberActive(m);
        const rankCost = RANK_MASTER[m.rank] || 0;

        const tr = document.createElement('tr');
        if (!active) {
            tr.style.opacity = '0.55';
        }
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="member-active-checkbox" ${active ? 'checked' : ''} onchange="onMemberActiveChange()" style="transform: scale(1.2); cursor: pointer;">
            </td>
            <td><input type="text" value="${pName}" class="member-name-input" style="width:130px;"></td>
            <td><input type="number" value="${m.exp}" class="member-exp-input" style="width:70px; text-align:center;"></td>
            <td>
                <select class="member-rank-select" style="width:130px;" onchange="onMemberRankChange()">
                    ${Object.keys(RANK_MASTER).map(r => `<option value="${r}" ${r === m.rank ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
            </td>
            <td style="color:var(--accent); font-weight:bold;">+${rankCost}</td>
            <td><button class="btn btn-danger" style="padding: 2px 8px; font-size:0.75rem;" onclick="deleteMember('${pName}')">削除</button></td>
        `;
        tbody.appendChild(tr);
    });

    updateMemberCountDisplay(ev);
}

function addMemberRow() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;
    collectMembersFromDOM(ev);

    let newName = "新規メンバー";
    let count = 1;
    while(ev.members[newName]) {
        newName = `新規メンバー(${count++})`;
    }
    ev.members[newName] = { active: true, exp: 100, rank: "一等兵" };
    renderMemberTable(ev);
    renderTacticsTable(ev);
}

function deleteMember(pName) {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;
    collectMembersFromDOM(ev);
    delete ev.members[pName];
    renderMemberTable(ev);
    renderTacticsTable(ev);
}

function renderTacticsTable(ev) {
    const tbody = document.getElementById('tbody-tactics');
    tbody.innerHTML = '';

    ev.tactics.forEach((row, idx) => {
        row.sync = false;
        const tr = createTacticsTr(row, idx + 1, ev);
        tbody.appendChild(tr);
    });

    const toggleAllHeader = document.getElementById('toggle-all-sync');
    if (toggleAllHeader) toggleAllHeader.checked = false;

    calculateStats();
}

function addTacticsRow() {
    const ev = events.find(e => e.id === currentEventId);
    ev.tactics.push(createEmptyTacticsRow());
    renderTacticsTable(ev);
}

function collectRowDataFromDOM(rowIndex, ev) {
    const tr = document.querySelectorAll('#tbody-tactics tr')[rowIndex];
    if (!tr || !ev.tactics[rowIndex]) return;
    const row = ev.tactics[rowIndex];

    const regCb = tr.querySelector('.row-reg-checkbox');
    const syncCb = tr.querySelector('.row-sync-checkbox');
    const tacticSel = tr.querySelector('.row-tactic-select');
    const turnInput = tr.querySelector('.row-turn-input');
    const playerSel = tr.querySelector('.row-player-select');
    const actualCostInput = tr.querySelector('.row-actualcost-input');
    const hpInput = tr.querySelector('.row-hp-input');
    const weaponInput = tr.querySelector('.row-weapon-input');
    const minRInput = tr.querySelector('.row-minr-input');
    const maxRInput = tr.querySelector('.row-maxr-input');
    const equipInput = tr.querySelector('.row-equip-input');
    const preSel = tr.querySelector('.row-pre-select');
    const postSel = tr.querySelector('.row-post-select');

    if (regCb) row.reg = regCb.checked;
    if (syncCb) row.sync = syncCb.checked;
    if (tacticSel) row.tactic = tacticSel.value;
    if (turnInput) row.turn = Number(turnInput.value);
    if (playerSel) row.player = playerSel.value;
    if (actualCostInput) row.actualCost = Number(actualCostInput.value);
    if (hpInput) row.hp = Number(hpInput.value);
    if (weaponInput) row.weapon = weaponInput.value;
    if (minRInput) row.minR = Number(minRInput.value);
    if (maxRInput) row.maxR = Number(maxRInput.value);
    if (equipInput) row.equip = equipInput.value;
    if (preSel) row.strPre = preSel.value;
    if (postSel) row.strPost = postSel.value;

    for (let i = 1; i <= 5; i++) {
        const tSel = tr.querySelector(`.row-t${i}-select`);
        const lSel = tr.querySelector(`.row-l${i}-select`);
        if (tSel) row['t' + i] = tSel.value;
        if (lSel) row['l' + i] = Number(lSel.value);
    }
    for (let i = 1; i <= 8; i++) {
        const cBox = tr.querySelector(`.row-c${i}-checkbox`);
        if (cBox) row['c' + i] = cBox.checked;
    }
    for (let i = 1; i <= 3; i++) {
        const rBox = tr.querySelector(`.row-r${i}-checkbox`);
        if (rBox) row['r' + i] = rBox.checked;
    }
}

function updateTraitStyle(selectEl, no, traitIndex) {
    collectRowDataFromDOM(no-1, events.find(e=>e.id===currentEventId));
    
    const tr = selectEl.closest('tr');
    const wrapper = tr.querySelector(`#trait-box-${no-1}-${traitIndex}`);
    if (!wrapper) return;

    const tSelect = wrapper.querySelector(`.row-t${traitIndex}-select`);
    const lSelect = wrapper.querySelector(`.row-l${traitIndex}-select`);

    const tVal = tSelect ? tSelect.value : "";
    const lVal = lSelect ? Number(lSelect.value) : 0;

    if (!tVal || lVal === 0) {
        wrapper.className = "trait-cell-wrapper trait-muted";
    } else {
        wrapper.className = "trait-cell-wrapper trait-active";
    }
}

function createTacticsTr(row, no, ev) {
    const tr = document.createElement('tr');

    const playerRank = ev.members[row.player] ? ev.members[row.player].rank : null;
    const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
    const mechaData = MECHA_DB[row.mecha] || { hp: 0, cost: 0 };
    const calcCost = (row.mecha ? mechaData.cost : 0) + addCost;
    const dbCost = row.mecha ? mechaData.cost : '#N/A';
    const dbHp = row.mecha ? mechaData.hp : '#N/A';

    const activePlayerNames = Object.keys(ev.members).filter(p => isMemberActive(ev.members[p]));
    if (row.player && !activePlayerNames.includes(row.player)) {
        activePlayerNames.push(row.player);
    }

    let tacticClass = "";
    if (row.tactic) {
        const lastChar = row.tactic.slice(-1).toUpperCase();
        if (lastChar === 'A') tacticClass = "tactic-a";
        else if (lastChar === 'D') tacticClass = "tactic-d";
        else if (lastChar === 'S') tacticClass = "tactic-s";
    }

    const traitBlockHtml = (selectedVal, selectedLv, traitIndex) => {
        const isMuted = !selectedVal || Number(selectedLv) === 0;
        const wrapperClass = isMuted ? "trait-cell-wrapper trait-muted" : "trait-cell-wrapper trait-active";

        const lvOptions = [...Array(11)].map((_, i) => {
            const val = 10 - i;
            return `<option value="${val}" ${Number(selectedLv) === val ? 'selected' : ''}>${val}</option>`;
        }).join('');

        return `
            <div class="${wrapperClass}" id="trait-box-${no-1}-${traitIndex}">
                <select class="trait-select row-t${traitIndex}-select" onchange="updateTraitStyle(this, ${no}, ${traitIndex})">
                    <option value="">(なし)</option>
                    ${TRAIT_MASTER.map(t => `<option value="${t}" ${t === selectedVal ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <select class="trait-lv-select row-l${traitIndex}-select" onchange="updateTraitStyle(this, ${no}, ${traitIndex})">
                    ${lvOptions}
                </select>
            </div>
        `;
    };

    tr.innerHTML = `
        <td><input type="checkbox" class="row-reg-checkbox" ${row.reg ? 'checked' : ''} onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId)); calculateStats();"></td>
        <td><input type="checkbox" class="row-sync-checkbox" ${row.sync ? 'checked' : ''} onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId));"></td>
        <td>${no}</td>
        <td>
            <select class="${tacticClass} row-tactic-select" onchange="changeTactic(this, ${no-1})">
                ${TACTICS_MASTER.map(t => `<option value="${t}" ${t === row.tactic ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" class="row-turn-input" value="${row.turn}" style="width:50px; text-align:center;" oninput="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId))"></td>
        <td>
            <select class="row-player-select" onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId)); renderTacticsTable(events.find(e=>e.id===currentEventId));" style="width:120px;">
                <option value="">選択</option>
                ${activePlayerNames.map(p => `<option value="${p}" ${p === row.player ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </td>
        <td style="color:var(--accent); font-weight:bold;">${calcCost || '#N/A'}</td>
        <td><input type="number" class="row-actualcost-input" value="${row.actualCost !== undefined ? row.actualCost : calcCost}" style="width:65px; text-align:center;" oninput="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId)); calculateStats();"></td>
        <td>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.8rem; width:100%; text-align:left; overflow:hidden; text-overflow:ellipsis;" onclick="openMechaSearchModal(${no-1})">
                ${row.mecha || '機体を検索...'}
            </button>
        </td>
        <td>${dbCost}</td>
        <td>${dbHp}</td>
        <td><input type="number" class="row-hp-input" value="${row.hp || (mechaData.hp || 0)}" style="width:65px; text-align:center;" oninput="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId)); calculateStats();"></td>
        <td><input type="text" class="weapon-input row-weapon-input" value="${row.weapon}" oninput="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId))"></td>
        
        <td><input type="number" min="0" max="99" class="row-minr-input" value="${row.minR}" style="width:50px; text-align:center;" oninput="updateRangeBar(this, ${no-1}, 'min')"></td>
        <td><input type="number" min="0" max="99" class="row-maxr-input" value="${row.maxR}" style="width:50px; text-align:center;" oninput="updateRangeBar(this, ${no-1}, 'max')"></td>
        <td>
            <div class="range-bar-container" id="range-bar-${no-1}">
                <div class="range-bar-fill" style="left: ${Math.min(100, Math.max(0, row.minR))}%; width: ${Math.max(0, Math.min(100 - row.minR, row.maxR - row.minR))}%;"></div>
            </div>
        </td>

        <td><input type="text" class="equip-input row-equip-input" value="${row.equip}" oninput="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId))"></td>
        
        <td>
            <select class="strategy-select row-pre-select" onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId))">
                ${STRATEGY_PRE_MASTER.map(s => `<option value="${s}" ${s === row.strPre ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </td>
        <td>
            <select class="strategy-select row-post-select" onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId))">
                ${STRATEGY_POST_MASTER.map(s => `<option value="${s}" ${s === row.strPost ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </td>

        <td>${traitBlockHtml(row.t1, row.l1, 1)}</td>
        <td>${traitBlockHtml(row.t2, row.l2, 2)}</td>
        <td>${traitBlockHtml(row.t3, row.l3, 3)}</td>
        <td>${traitBlockHtml(row.t4, row.l4, 4)}</td>
        <td>${traitBlockHtml(row.t5, row.l5, 5)}</td>

        ${[...Array(8)].map((_, i) => `<td><input type="checkbox" class="row-c${i+1}-checkbox" ${row['c'+(i+1)] ? 'checked' : ''} onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId)); calculateStats();"></td>`).join('')}
        ${[...Array(3)].map((_, i) => `<td><input type="checkbox" class="row-r${i+1}-checkbox" ${row['r'+(i+1)] ? 'checked' : ''} onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId)); calculateStats();"></td>`).join('')}
    `;

    return tr;
}

function changeTactic(selectEl, rowIndex) {
    const ev = events.find(e => e.id === currentEventId);
    const val = selectEl.value;
    ev.tactics[rowIndex].tactic = val;

    selectEl.className = "row-tactic-select ";
    const lastChar = val.slice(-1).toUpperCase();
    if (lastChar === 'A') selectEl.classList.add('tactic-a');
    else if (lastChar === 'D') selectEl.classList.add('tactic-d');
    else if (lastChar === 'S') selectEl.classList.add('tactic-s');

    calculateStats();
}

function updateRangeBar(inputEl, rowIndex, type) {
    const ev = events.find(e => e.id === currentEventId);
    const row = ev.tactics[rowIndex];
    const tr = inputEl.closest('tr');
    
    if (type === 'min') row.minR = Number(inputEl.value);
    if (type === 'max') row.maxR = Number(inputEl.value);
    
    collectRowDataFromDOM(rowIndex, ev);

    const barFill = tr.querySelector('.range-bar-fill');
    if (barFill) {
        const min = Math.min(100, Math.max(0, row.minR));
        const max = Math.max(0, Math.min(100, row.maxR));
        barFill.style.left = min + '%';
        barFill.style.width = Math.max(0, max - min) + '%';
    }
}

function calculateStats() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    let regCount = 0;
    let checkedHp = 0, totalHp = 0, totalCalcCost = 0, totalActualCost = 0, totalActualCostAll = 0, totalDbHpAll = 0;
    
    let tacticCounts = {};

    let sumCols = {};
    for(let i=1; i<=8; i++) sumCols['c'+i] = 0;
    for(let i=1; i<=3; i++) sumCols['r'+i] = 0;

    ev.tactics.forEach(r => {
        const hpVal = Number(r.hp || 0);
        totalHp += hpVal;

        const mechaData = MECHA_DB[r.mecha] || { cost: 0, hp: 0 };
        const playerRank = ev.members[r.player] ? ev.members[r.player].rank : null;
        const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
        const calcC = (r.mecha ? mechaData.cost : 0) + addCost;
        const actualC = r.actualCost !== undefined ? Number(r.actualCost) : calcC;

        totalActualCostAll += actualC;
        totalCalcCost += calcC;
        totalDbHpAll += Number(mechaData.hp || 0);

        if (r.reg) {
            regCount++;
            checkedHp += hpVal;
            totalActualCost += actualC;
        }

        const t = r.tactic || '未設定';
        tacticCounts[t] = (tacticCounts[t] || 0) + 1;

        for(let i=1; i<=8; i++) {
            if (r['c'+i]) sumCols['c'+i]++;
        }
        for(let i=1; i<=3; i++) {
            if (r['r'+i]) sumCols['r'+i]++;
        }
    });

    const sortedTactics = Object.keys(tacticCounts).sort((a, b) => {
        const order = { 'A': 1, 'D': 2, 'S': 3 };
        const orderA = order[a.slice(-1).toUpperCase()] || 99;
        const orderB = order[b.slice(-1).toUpperCase()] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b);
    });

    const breakdownStr = sortedTactics.length > 0 
        ? sortedTactics.map(t => {
            const lastChar = t.slice(-1).toUpperCase();
            let badgeClass = '';
            if (lastChar === 'A') badgeClass = 'tactic-badge-a';
            else if (lastChar === 'D') badgeClass = 'tactic-badge-d';
            else if (lastChar === 'S') badgeClass = 'tactic-badge-s';
            return `<span class="${badgeClass}">${t}</span> ${tacticCounts[t]}`;
          }).join('、') 
        : 'なし';

    document.getElementById('stat-count').innerText = regCount;
    document.getElementById('stat-total-rows').innerText = ev.tactics.length;
    document.getElementById('stat-tactics-breakdown').innerHTML = breakdownStr;
    
    document.getElementById('stat-cost').innerText = totalCalcCost.toLocaleString();
    document.getElementById('stat-db-hp').innerText = totalDbHpAll.toLocaleString();

    document.getElementById('stat-actual-cost-total').innerText = totalActualCostAll.toLocaleString();
    document.getElementById('stat-total-hp').innerText = totalHp.toLocaleString();

    document.getElementById('stat-actual-cost-reg').innerText = totalActualCost.toLocaleString();
    document.getElementById('stat-hp').innerText = checkedHp.toLocaleString();

    const tfoot = document.getElementById('tfoot-tactics');
    tfoot.innerHTML = `
        <tr>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: right; font-weight: bold;">合計：</td>
            <td style="text-align: center;">${totalCalcCost.toLocaleString()}</td>
            <td style="text-align: center;">${totalActualCost.toLocaleString()}</td>
            <td></td><td></td><td></td>
            <td style="text-align: center;">${totalHp.toLocaleString()}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            <td></td><td></td><td></td><td></td><td></td>
            <td style="text-align: center;">${sumCols['c1']}</td>
            <td style="text-align: center;">${sumCols['c2']}</td>
            <td style="text-align: center;">${sumCols['c3']}</td>
            <td style="text-align: center;">${sumCols['c4']}</td>
            <td style="text-align: center;">${sumCols['c5']}</td>
            <td style="text-align: center;">${sumCols['c6']}</td>
            <td style="text-align: center;">${sumCols['c7']}</td>
            <td style="text-align: center;">${sumCols['c8']}</td>
            <td style="text-align: center;">${sumCols['r1']}</td>
            <td style="text-align: center;">${sumCols['r2']}</td>
            <td style="text-align: center;">${sumCols['r3']}</td>
        </tr>
    `;
}

function renderSummaryCards() {
    const evData = events.find(e => e.id === currentEventId);
    if (!evData) return;

    const container = document.getElementById('summary-cards');
    container.innerHTML = '';

    const memberNames = Object.keys(evData.members).filter(p => isMemberActive(evData.members[p]));
    
    if (memberNames.length === 0) {
        container.innerHTML = '<p class="sub-title">「参加メンバー・階級設定」タブで出場にチェックが入っているメンバーがいません。</p>';
        return;
    }

    memberNames.forEach(pName => {
        const mInfo = evData.members[pName];
        const assignedTactics = evData.tactics.filter(r => r.player === pName);

        const card = document.createElement('div');
        card.className = 'summary-item-card';

        let tacticsHtml = '';
        if (assignedTactics.length === 0) {
            tacticsHtml = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 5px 0;">（割当作戦なし）</div>';
        } else {
            assignedTactics.forEach((r, idx) => {
                const traitsStr = [
                    r.t1 ? `${r.t1}(${r.l1})` : '',
                    r.t2 ? `${r.t2}(${r.l2})` : '',
                    r.t3 ? `${r.t3}(${r.l3})` : '',
                    r.t4 ? `${r.t4}(${r.l4})` : '',
                    r.t5 ? `${r.t5}(${r.l5})` : ''
                ].filter(Boolean).join(', ');

                tacticsHtml += `
                    <div style="border-top: 1px dashed var(--border); padding-top: 8px; margin-top: 8px;">
                        <div style="display: flex; justify-content: space-between; color: var(--accent); font-size: 0.9rem; font-weight: bold;">
                            <span>[作戦${idx + 1}] 団体: ${r.tactic || '-'}</span>
                            <span>登場 T: ${r.turn}</span>
                        </div>
                        <div style="font-size: 0.85rem; margin-top: 3px;"><strong>機体:</strong> ${r.mecha || '-'} (実HP: ${r.hp} / <strong>実コスト:</strong> <span style="color: var(--accent-warn);">${r.actualCost !== undefined ? r.actualCost : 0}</span>)</div>
                        <div style="font-size: 0.85rem;"><strong>武装:</strong> ${r.weapon || '-'} (射程: ${r.minR}〜${r.maxR})</div>
                        <div style="font-size: 0.85rem;"><strong>装備:</strong> ${r.equip || '-'}</div>
                        <div style="margin-top: 4px; color: var(--text-muted); font-size: 0.80rem;">
                            個人戦術: ${r.strPre || '-'} / ${r.strPost || '-'}<br>
                            特性: ${traitsStr || '-'}
                        </div>
                    </div>
                `;
            });
        }

        card.innerHTML = `
            <div class="summary-header">
                <span>👤 ${pName}</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">階級: ${mInfo.rank} / 熟練度: ${mInfo.exp}</span>
            </div>
            <div style="margin-top: 5px;">
                ${tacticsHtml}
            </div>
        `;

        container.appendChild(card);
    });
}
