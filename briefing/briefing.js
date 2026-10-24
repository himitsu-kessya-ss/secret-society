let currentEventId = null;

// グローバルで機体データベースを保持
let MECHA_DB = {};

// アプリ起動時の処理
window.onload = async function() {
    // 1. CSVファイルから機体データを非同期で読み込む
    await loadMechaCsv();

    // 2. イベントデータの初期化と画面描画
    initDefaultEventData(events[0]);
    renderEventList();
};

// CSV読み込み関数 (2列目: 機体名, 4列目: HP, 18列目: コスト)
async function loadMechaCsv() {
    try {
        const response = await fetch('GL)機体一覧 - 機体一覧.csv');
        if (!response.ok) {
            throw new Error('CSVファイルの読み込みに失敗しました');
        }
        const csvText = await response.text();
        const lines = csvText.split('\n');

        MECHA_DB = {}; // 初期化

        lines.forEach((line) => {
            if (!line.trim()) return;

            const cols = line.split(',').map(col => col.replace(/^"|"$/g, '').trim());

            if (cols.length >= 18) {
                const mechaName = cols[1];
                const hpVal = Number(cols[3]) || 0;
                const costVal = Number(cols[17]) || 0;

                if (mechaName) {
                    MECHA_DB[mechaName] = { 
                        hp: hpVal, 
                        cost: costVal 
                    };
                }
            }
        });
        console.log("機体CSVの読み込み完了 (HP:4列目 / コスト:18列目):", MECHA_DB);
    } catch (err) {
        console.warn("CSVの読み込みに失敗したため、フォールバック用データを使用します。", err);
        MECHA_DB = {
            "ガンダム": { hp: 384, cost: 38 },
            "バンシィ": { hp: 576, cost: 64 }
        };
    }
}

function initDefaultEventData(ev) {
    DEFAULT_PLAYERS.forEach((p, idx) => {
        ev.members[p] = { exp: 150 + idx * 10, rank: "曹長" };
    });
    ev.members["Oro🍊min"] = { exp: 294, rank: "特務准尉" };
    ev.members["Halbert"] = { exp: 265, rank: "先任曹長" };

    ev.tactics = [
        { reg: true, tactic: "DA", turn: 10, player: "Oro🍊min", mecha: "ガンダム", hp: 501, weapon: "★フルバースト", minR: 20, maxR: 70, equip: "プロペラントタンク", str: "移動しない攻撃", t1: "集中10", t2: "機転10", t3:"", t4:"", t5:"", c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0 },
        { reg: true, tactic: "DA", turn: 1, player: "Yggdrasill", mecha: "ガリルナガン", hp: 696, weapon: "アキシオン・アッシャー", minR: 50, maxR: 90, equip: "プロペラントタンク", str: "足止め攻撃", t1: "集中10", t2: "繊細10", t3:"偵察7", t4:"", t5:"", c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0 }
    ];
}

function renderEventList() {
    const listEl = document.getElementById('event-list');
    listEl.innerHTML = '';
    events.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.onclick = () => openAuthModal(ev.id);
        card.innerHTML = `
            <h3>${ev.title}</h3>
            <p class="sub-title" style="margin-top:8px;">🔒 要パスワード保護</p>
        `;
        listEl.appendChild(card);
    });
}

function showMainPage() {
    document.getElementById('page-briefing-room').classList.remove('hidden');
    document.getElementById('page-event-sheet').classList.add('hidden');
    document.getElementById('btn-back-main').classList.add('hidden');
    currentEventId = null;
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-create').classList.add('hidden');
    document.getElementById('modal-auth').classList.add('hidden');
}

function openCreateModal() {
    document.getElementById('input-admin-pw').value = '';
    document.getElementById('input-event-title').value = '';
    document.getElementById('input-event-pw').value = '';
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-create').classList.remove('hidden');
}

function submitCreateEvent() {
    const adminPw = document.getElementById('input-admin-pw').value;
    const title = document.getElementById('input-event-title').value;
    const eventPw = document.getElementById('input-event-pw').value;

    if (adminPw !== 'p@ssw0rd') {
        alert('管理者パスワードが正しくありません。');
        return;
    }
    if (!title || !eventPw) {
        alert('イベント名と入室パスワードを入力してください。');
        return;
    }

    const newEv = {
        id: 'ev_' + Date.now(),
        title: title,
        pass: eventPw,
        members: {},
        tactics: []
    };
    initDefaultEventData(newEv);
    events.push(newEv);
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

    // ★修正点：イベント固有のパスワード一致 ＋ または 管理者PW "p@ssw0rd" なら入室許可
    if (ev && (inputPw === ev.pass || inputPw === 'p@ssw0rd')) {
        closeModal();
        loadEventSheet(ev);
    } else {
        alert('パスワードが正しくありません。');
    }
}

function loadEventSheet(ev) {
    document.getElementById('page-briefing-room').classList.add('hidden');
    document.getElementById('page-event-sheet').classList.remove('hidden');
    document.getElementById('btn-back-main').classList.remove('hidden');

    document.getElementById('sheet-event-title').innerText = ev.title;
    document.getElementById('sheet-event-desc').innerText = `イベントID: ${ev.id} | 作戦共有中`;

    renderMemberTable(ev);
    renderTacticsTable(ev);
    switchTab('plan');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    if (tabName === 'plan') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tab-plan').classList.remove('hidden');
    } else if (tabName === 'member') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tab-member').classList.remove('hidden');
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
        const rankCost = RANK_MASTER[m.rank] || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${pName}" onchange="renameMember('${pName}', this.value)"></td>
            <td><input type="number" value="${m.exp}" onchange="ev.members['${pName}'].exp = this.value"></td>
            <td>
                <select onchange="updateMemberRank('${pName}', this.value)">
                    ${Object.keys(RANK_MASTER).map(r => `<option value="${r}" ${r === m.rank ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
            </td>
            <td style="color:var(--accent); font-weight:bold;">+${rankCost}</td>
            <td><button class="btn btn-danger" style="padding: 2px 8px; font-size:0.75rem;" onclick="deleteMember('${pName}')">削除</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function addMemberRow() {
    const ev = events.find(e => e.id === currentEventId);
    let newName = "新規メンバー";
    let count = 1;
    while(ev.members[newName]) {
        newName = `新規メンバー(${count++})`;
    }
    ev.members[newName] = { exp: 100, rank: "一等兵" };
    renderMemberTable(ev);
}

function renameMember(oldName, newName) {
    const ev = events.find(e => e.id === currentEventId);
    if(!newName || ev.members[newName]) {
        alert('無効な名前か、既に存在する名前です。');
        renderMemberTable(ev);
        return;
    }
    ev.members[newName] = ev.members[oldName];
    delete ev.members[oldName];
    ev.tactics.forEach(t => { if(t.player === oldName) t.player = newName; });
    renderMemberTable(ev);
}

function deleteMember(pName) {
    const ev = events.find(e => e.id === currentEventId);
    delete ev.members[pName];
    renderMemberTable(ev);
}

function updateMemberRank(pName, newRank) {
    const ev = events.find(e => e.id === currentEventId);
    ev.members[pName].rank = newRank;
    renderMemberTable(ev);
    renderTacticsTable(ev);
}

function renderTacticsTable(ev) {
    const tbody = document.getElementById('tbody-tactics');
    tbody.innerHTML = '';

    ev.tactics.forEach((row, idx) => {
        const tr = createTacticsTr(row, idx + 1, ev);
        tbody.appendChild(tr);
    });

    calculateStats();
}

function addTacticsRow() {
    const ev = events.find(e => e.id === currentEventId);
    ev.tactics.push({
        reg: false, tactic: "AA", turn: 1, player: "", mecha: "", hp: 0, weapon: "", minR: 0, maxR: 20, equip: "", str: "", t1: "", t2: "", t3: "", t4: "", t5: "", c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0
    });
    renderTacticsTable(ev);
}

function createTacticsTr(row, no, ev) {
    const tr = document.createElement('tr');

    const playerRank = ev.members[row.player] ? ev.members[row.player].rank : null;
    const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
    const mechaData = MECHA_DB[row.mecha] || { hp: 0, cost: 0 };
    const calcCost = (row.mecha ? mechaData.cost : 0) + addCost;
    const dbCost = row.mecha ? mechaData.cost : '#N/A';
    const dbHp = row.mecha ? mechaData.hp : '#N/A';

    tr.innerHTML = `
        <td><input type="checkbox" ${row.reg ? 'checked' : ''} onchange="row.reg = this.checked; calculateStats();"></td>
        <td>${no}</td>
        <td>
            <select onchange="row.tactic = this.value">
                ${TACTICS_MASTER.map(t => `<option value="${t}" ${t === row.tactic ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" value="${row.turn}" style="width:45px;" onchange="row.turn = this.value"></td>
        <td>
            <select onchange="row.player = this.value; renderTacticsTable(ev);">
                <option value="">選択</option>
                ${Object.keys(ev.members).map(p => `<option value="${p}" ${p === row.player ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </td>
        <td style="color:var(--accent); font-weight:bold;">${calcCost || '#N/A'}</td>
        <td>
            <select onchange="row.mecha = this.value; row.hp = MECHA_DB[this.value] ? MECHA_DB[this.value].hp : 0; renderTacticsTable(ev);">
                <option value="">選択</option>
                ${Object.keys(MECHA_DB).map(m => `<option value="${m}" ${m === row.mecha ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
        </td>
        <td>${dbCost}</td>
        <td>${dbHp}</td>
        <td><input type="number" value="${row.hp || (mechaData.hp || 0)}" style="width:60px;" onchange="row.hp = Number(this.value); calculateStats();"></td>
        <td><input type="text" value="${row.weapon}" onchange="row.weapon = this.value"></td>
        <td><input type="number" min="0" max="99" value="${row.minR}" style="width:50px;" onchange="row.minR = Number(this.value); renderTacticsTable(ev);"></td>
        <td><input type="number" min="0" max="99" value="${row.maxR}" style="width:50px;" onchange="row.maxR = Number(this.value); renderTacticsTable(ev);"></td>
        <td>
            <div class="range-bar-container">
                <div class="range-bar-fill" style="left: ${Math.min(100, Math.max(0, row.minR))}%; width: ${Math.max(0, Math.min(100 - row.minR, row.maxR - row.minR))}%;"></div>
            </div>
        </td>
        <td><input type="text" value="${row.equip}" onchange="row.equip = this.value"></td>
        <td><input type="text" value="${row.str}" onchange="row.str = this.value"></td>
        <td><input type="text" value="${row.t1}" style="width:80px;" onchange="row.t1 = this.value"></td>
        <td><input type="text" value="${row.t2}" style="width:80px;" onchange="row.t2 = this.value"></td>
        <td><input type="text" value="${row.t3}" style="width:80px;" onchange="row.t3 = this.value"></td>
        <td><input type="text" value="${row.t4}" style="width:80px;" onchange="row.t4 = this.value"></td>
        <td><input type="text" value="${row.t5}" style="width:80px;" onchange="row.t5 = this.value"></td>
        ${[...Array(8)].map((_, i) => `<td><input type="number" value="${row['c'+(i+1)] || 0}" style="width:35px;" onchange="row.c${i+1} = this.value"></td>`).join('')}
        ${[...Array(3)].map((_, i) => `<td><input type="number" value="${row['r'+(i+1)] || 0}" style="width:35px;" onchange="row.r${i+1} = this.value"></td>`).join('')}
    `;

    return tr;
}

function calculateStats() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    let count = 0, totalHp = 0, totalCost = 0;

    ev.tactics.forEach(r => {
        if (r.reg) {
            count++;
            const mechaData = MECHA_DB[r.mecha] || { cost: 0 };
            const playerRank = ev.members[r.player] ? ev.members[r.player].rank : null;
            const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;

            totalHp += Number(r.hp || 0);
            totalCost += (r.mecha ? mechaData.cost : 0) + addCost;
        }
    });

    document.getElementById('stat-count').innerText = count;
    document.getElementById('stat-hp').innerText = totalHp.toLocaleString();
    document.getElementById('stat-cost').innerText = totalCost.toLocaleString();
}

function renderSummaryCards() {
    const ev = events.find(e => e.id === currentEventId);
    const container = document.getElementById('summary-cards');
    container.innerHTML = '';

    const activeRows = ev.tactics.filter(r => r.reg);
    if (activeRows.length === 0) {
        container.innerHTML = '<p class="sub-title">登録にチェックが入っている機体がありません。</p>';
        return;
    }

    activeRows.forEach(r => {
        const card = document.createElement('div');
        card.className = 'summary-item-card';
        card.innerHTML = `
            <div class="summary-header">
                <span>${r.player || '未設定'} (${r.tactic})</span>
                <span>T: ${r.turn}</span>
            </div>
            <div><strong>機体:</strong> ${r.mecha || '-'} (HP: ${r.hp})</div>
            <div><strong>武装:</strong> ${r.weapon || '-'} (射程: ${r.minR}〜${r.maxR})</div>
            <div><strong>装備:</strong> ${r.equip || '-'}</div>
            <div style="margin-top:8px; color:var(--text-muted); font-size:0.8rem;">
                個人戦術: ${r.str || '-'}<br>
                特性: ${[r.t1, r.t2, r.t3, r.t4, r.t5].filter(Boolean).join(', ') || '-'}
            </div>
        `;
        container.appendChild(card);
    });
}
