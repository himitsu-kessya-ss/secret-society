// ★スプレッドシートから発行された「ウェブアプリのURL」
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxJFwDlx71xhfSF3mp6cSK46zog3cSM7kr_3tkGocyQJpnfbzQ8dDPWSjfxG5C7lcdejA/exec';

let currentEventId = null;
let currentTab = 'plan';
let MECHA_DB = {}; 
let mechaListArray = []; 
let editingRowIndex = null; 

const RANK_MASTER = {
    "民間人": 0, "志願兵": 1, "二等兵": 2, "一等兵": 3, "上等兵": 4, "兵長": 5,
    "上級兵長": 6, "伍長": 7, "上級伍長": 8, "軍曹": 9, "上級軍曹": 10, "先任軍曹": 11,
    "曹長": 12, "上級曹長": 13, "先任曹長": 14, "准尉": 15, "上級准尉": 16, "特務准尉": 17,
    "少尉": 18, "中尉": 19, "上級中尉": 20, "大尉": 21, "特務大尉": 22, "戦術大尉": 23,
    "少佐": 24, "作戦少佐": 25, "特殊作戦少佐": 26, "中佐": 27, "特務中佐": 28, "大佐": 29, "准将": 30,
    "少将": 31, "艦隊少将": 32, "中将": 33, "方面軍中将": 34, "大将": 35, "上級大将": 36,
    "宇宙軍元帥": 37, "元帥": 38, "統合軍元帥": 39, "大元帥": 40, "総帥補佐官": 41, "総帥府長官": 42,
    "副総帥": 43, "総帥": 44
};

const TRAIT_MASTER = [
    "豪胆", "豪快", "冷酷", "清涼", "短気", "熱血", "半端", "凡庸", "沈着", "策士",
    "迅速", "機転", "冷静", "傲慢", "一途", "暴走", "不屈", "執念", "配慮", "倹約",
    "強欲", "流行", "脱力", "頑丈", "感応", "器用", "集中", "気弱", "悪戯", "実直",
    "節約", "陶酔", "偏屈", "悪運", "冷血", "鈍感", "偵察", "覚醒", "再生", "闘志",
    "威圧", "鍛錬", "一徹", "威風", "堅実", "明朗", "繊細", "高尚", "闘争"
];

const STRATEGY_PRE_MASTER = ["移動", "足止め", "移動しない"];
const STRATEGY_POST_MASTER = ["攻撃", "回避", "撹乱", "操縦"];

const TACTICS_MASTER = ["NS", "AS", "DS", "SS", "NA", "AA", "DA", "SA", "ND", "AD", "DD", "SD", "LA", "LD", "LS"];
const DEFAULT_PLAYERS = ["Oro🍊min", "Halbert", "Yggdrasill", "スパイク", "キッド", "ボブ", "リーア", "ハチワレ", "ナイト"];

let events = [];

window.onload = async function() {
    localStorage.removeItem('secret_society_briefing_state_v3');
    showMainPage();

    await loadMechaCsv();
    await loadEventsFromServer(false); 
};

// 【手動】サーバーから最新データを取得
async function manualLoadFromServer() {
    await loadEventsFromServer(false);
    alert('サーバーから最新データを読み込みました！');
}

async function loadEventsFromServer(isBackground = false) {
    if (!GAS_URL) {
        initDefaultEvents();
        if (!isBackground) renderEventList();
        return;
    }

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && data.events && data.events.length > 0) {
            events = data.events;
        } else {
            initDefaultEvents();
        }
    } catch (e) {
        console.warn("サーバーからのデータ取得に失敗しました。ローカルデータを使用します。", e);
        initDefaultEvents();
    }

    if (!isBackground) {
        if (!currentEventId) {
            renderEventList();
        } else {
            const ev = events.find(e => e.id === currentEventId);
            if (ev) {
                renderMemberTable(ev);
                renderTacticsTable(ev);
            }
        }
    } else {
        if (currentEventId) {
            const ev = events.find(ev => ev.id === currentEventId);
            if (ev) calculateStats();
        }
    }
}

async function saveEventsToServer() {
    if (!GAS_URL) return;
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: events })
        });
    } catch (e) {
        console.error("サーバーへの保存に失敗しました", e);
    }
}

// 【作戦立案タブ用】「更新対象」がONの行だけをサーバーのデータにマージして保存
async function saveSelectedTacticsToServer() {
    if (!GAS_URL) return;
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && data.events) {
            events = data.events;
        }
    } catch(e) {}

    let targetEv = events.find(e => e.id === currentEventId);
    if (!targetEv) return;

    const rows = document.querySelectorAll('#tbody-tactics tr');
    let updatedCount = 0;

    rows.forEach((tr, idx) => {
        const syncCheckbox = tr.querySelector('.row-sync-checkbox');
        if (syncCheckbox && syncCheckbox.checked) {
            collectRowDataFromDOM(idx, ev);
            
            if (!targetEv.tactics[idx]) {
                targetEv.tactics[idx] = JSON.parse(JSON.stringify(ev.tactics[idx]));
            } else {
                targetEv.tactics[idx] = JSON.parse(JSON.stringify(ev.tactics[idx]));
            }
            updatedCount++;
            syncCheckbox.checked = false;
        }
    });

    if (updatedCount === 0) {
        alert('「更新対象」にチェックが入っている行がありません。更新したい行のチェックボックスをONにしてください。');
        return;
    }

    await saveEventsToServer();
    alert(`選択された ${updatedCount} 行の作戦データをサーバーに反映しました！`);
    renderTacticsTable(targetEv);
}

// 【メンバータブ用】メンバー情報をサーバー全体に保存
async function saveMembersToServer() {
    if (!GAS_URL) return;
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && data.events) {
            events = data.events;
        }
    } catch(e) {}

    let targetEv = events.find(e => e.id === currentEventId);
    if (!targetEv) return;

    const memberRows = document.querySelectorAll('#tbody-members tr');
    let newMembersObj = {};

    memberRows.forEach(tr => {
        const nameInput = tr.querySelector('.member-name-input');
        const expInput = tr.querySelector('.member-exp-input');
        const rankSelect = tr.querySelector('.member-rank-select');
        if (nameInput && nameInput.value) {
            newMembersObj[nameInput.value] = {
                exp: Number(expInput ? expInput.value : 100),
                rank: rankSelect ? rankSelect.value : '一等兵'
            };
        }
    });

    targetEv.members = newMembersObj;
    await saveEventsToServer();
    alert('参加メンバー・階級情報をサーバーに保存しました！');
    renderMemberTable(targetEv);
    renderTacticsTable(targetEv);
}

function initDefaultEvents() {
    events = [
        { id: 'ev1', title: '26.10 勢力戦', pass: '1234', members: {}, tactics: [] }
    ];
    initDefaultEventData(events[0]);
    saveEventsToServer();
}

async function loadMechaCsv() {
    try {
        const response = await fetch('GL)機体一覧 - 機体一覧.csv');
        if (!response.ok) throw new Error('CSV読み込み失敗');
        const csvText = await response.text();
        const lines = csvText.split('\n');

        MECHA_DB = {};
        mechaListArray = [];

        lines.forEach((line) => {
            if (!line.trim()) return;
            const cols = line.split(',').map(col => col.replace(/^"|"$/g, '').trim());

            if (cols.length >= 18) {
                const mechaNo = cols[0];   
                const mechaName = cols[1]; 
                const hpVal = Number(cols[3]) || 0;     
                const costVal = Number(cols[17]) || 0;  

                if (mechaName) {
                    MECHA_DB[mechaName] = { hp: hpVal, cost: costVal, no: mechaNo };
                    mechaListArray.push({ name: mechaName, hp: hpVal, cost: costVal, no: mechaNo });
                }
            }
        });
    } catch (err) {
        MECHA_DB = {
            "ガンダム": { hp: 384, cost: 38, no: "1" },
            "バンシィ": { hp: 576, cost: 64, no: "2" },
            "ガリルナガン": { hp: 700, cost: 72, no: "3" }
        };
        mechaListArray = Object.keys(MECHA_DB).map(k => ({ name: k, ...MECHA_DB[k] }));
    }
}

function initDefaultEventData(ev) {
    DEFAULT_PLAYERS.forEach((p, idx) => {
        ev.members[p] = { exp: 150 + idx * 10, rank: "曹長" };
    });
    ev.members["Oro🍊min"] = { exp: 294, rank: "特務准尉" };
    ev.members["Halbert"] = { exp: 265, rank: "先任曹長" };

    ev.tactics = [
        { reg: true, sync: false, tactic: "DA", actualCost: 38, turn: 10, player: "Oro🍊min", mecha: "ガンダム", hp: 501, weapon: "★フルバースト", minR: 20, maxR: 70, equip: "プロペラントタンク", strPre: "移動しない", strPost: "攻撃", 
          t1: "集中", l1: 10, t2: "機転", l2: 10, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
          c1:false, c2:false, c3:false, c4:false, c5:false, c6:false, c7:false, c8:false, r1:false, r2:false, r3:false },
        { reg: true, sync: false, tactic: "DA", actualCost: 72, turn: 1, player: "Yggdrasill", mecha: "ガリルナガン", hp: 696, weapon: "アキシオン・アッシャー", minR: 50, maxR: 90, equip: "プロペラントタンク", strPre: "足止め", strPost: "回避", 
          t1: "集中", l1: 10, t2: "繊細", l2: 10, t3: "偵察", l3: 7, t4: "", l4: 0, t5: "", l5: 0, 
          c1:false, c2:false, c3:false, c4:false, c5:false, c6:false, c7:false, c8:false, r1:false, r2:false, r3:false }
    ];
}

function renderEventList() {
    const listEl = document.getElementById('event-list');
    if (!listEl) return;
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
    document.getElementById('global-sync-controls').classList.add('hidden');
    currentEventId = null;
    renderEventList();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-create').classList.add('hidden');
    document.getElementById('modal-auth').classList.add('hidden');
    document.getElementById('modal-mecha-search').classList.add('hidden');
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
    saveEventsToServer();
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

function loadEventSheet(ev) {
    currentEventId = ev.id;

    document.getElementById('page-briefing-room').classList.add('hidden');
    document.getElementById('page-event-sheet').classList.remove('hidden');
    document.getElementById('btn-back-main').classList.remove('hidden');
    document.getElementById('global-sync-controls').classList.remove('hidden');

    document.getElementById('sheet-event-title').innerText = ev.title;
    document.getElementById('sheet-event-desc').innerText = `イベントID: ${ev.id} | 手動同期モード`;

    renderMemberTable(ev);
    renderTacticsTable(ev);
    switchTab('plan');
}

function switchTab(tabName) {
    currentTab = tabName;

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
            <td><input type="text" value="${pName}" class="member-name-input" style="width:120px;"></td>
            <td><input type="number" value="${m.exp}" class="member-exp-input" style="width:70px; text-align:center;"></td>
            <td>
                <select class="member-rank-select" style="width:130px;">
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

function deleteMember(pName) {
    const ev = events.find(e => e.id === currentEventId);
    delete ev.members[pName];
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
        reg: false, sync: true, tactic: "AA", actualCost: 0, turn: 1, player: "", mecha: "", hp: 0, weapon: "", minR: 0, maxR: 20, equip: "", 
        strPre: "移動", strPost: "攻撃", 
        t1: "", l1: 0, t2: "", l2: 0, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
        c1:false, c2:false, c3:false, c4:false, c5:false, c6:false, c7:false, c8:false, r1:false, r2:false, r3:false
    });
    renderTacticsTable(ev);
}

// 画面上のDOMから指定行のデータを抽出してローカルオブジェクトに格納
function collectRowDataFromDOM(rowIndex, ev) {
    const tr = document.querySelectorAll('#tbody-tactics tr')[rowIndex];
    if (!tr || !ev.tactics[rowIndex]) return;
    const row = ev.tactics[rowIndex];

    const regCb = tr.querySelector('.row-reg-checkbox');
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

function createTacticsTr(row, no, ev) {
    const tr = document.createElement('tr');

    const playerRank = ev.members[row.player] ? ev.members[row.player].rank : null;
    const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
    const mechaData = MECHA_DB[row.mecha] || { hp: 0, cost: 0 };
    const calcCost = (row.mecha ? mechaData.cost : 0) + addCost;
    const dbCost = row.mecha ? mechaData.cost : '#N/A';
    const dbHp = row.mecha ? mechaData.hp : '#N/A';

    let tacticClass = "";
    if (row.tactic) {
        const lastChar = row.tactic.slice(-1).toUpperCase();
        if (lastChar === 'A') tacticClass = "tactic-a";
        else if (lastChar === 'D') tacticClass = "tactic-d";
        else if (lastChar === 'S') tacticClass = "tactic-s";
    }

    const traitSelectHtml = (selectedVal, traitIndex) => `
        <select class="trait-select row-t${traitIndex}-select" onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId))">
            <option value="">(なし)</option>
            ${TRAIT_MASTER.map(t => `<option value="${t}" ${t === selectedVal ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
    `;

    const lvSelectHtml = (selectedLv, lvKey, lvNum) => `
        <select class="trait-lv-select row-l${lvNum}-select" onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId))">
            ${[...Array(11)].map((_, i) => `<option value="${i}" ${Number(selectedLv) === i ? 'selected' : ''}>${i === 0 ? '0' : i}</option>`).join('')}
        </select>
    `;

    tr.innerHTML = `
        <td><input type="checkbox" class="row-reg-checkbox" ${row.reg ? 'checked' : ''} onchange="collectRowDataFromDOM(${no-1}, events.find(e=>e.id===currentEventId)); calculateStats();"></td>
        <td><input type="checkbox" class="row-sync-checkbox" ${row.sync ? 'checked' : ''}></td>
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
                ${Object.keys(ev.members).map(p => `<option value="${p}" ${p === row.player ? 'selected' : ''}>${p}</option>`).join('')}
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

        <td>${traitSelectHtml(row.t1, 1)} ${lvSelectHtml(row.l1, 'l1', 1)}</td>
        <td>${traitSelectHtml(row.t2, 2)} ${lvSelectHtml(row.l2, 'l2', 2)}</td>
        <td>${traitSelectHtml(row.t3, 3)} ${lvSelectHtml(row.l3, 'l3', 3)}</td>
        <td>${traitSelectHtml(row.t4, 4)} ${lvSelectHtml(row.l4, 'l4', 4)}</td>
        <td>${traitSelectHtml(row.t5, 5)} ${lvSelectHtml(row.l5, 'l5', 5)}</td>

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

function openMechaSearchModal(rowIndex) {
    editingRowIndex = rowIndex;
    document.getElementById('input-mecha-query').value = '';
    renderMechaSearchResults(mechaListArray);
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-mecha-search').classList.remove('hidden');
}

function filterMechaList() {
    const query = document.getElementById('input-mecha-query').value.toLowerCase();
    const filtered = mechaListArray.filter(m => 
        m.name.toLowerCase().includes(query) || String(m.no).toLowerCase().includes(query)
    );
    renderMechaSearchResults(filtered);
}

function renderMechaSearchResults(list) {
    const container = document.getElementById('mecha-search-results');
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--text-muted); text-align:center;">該当する機体が見つかりません</div>';
        return;
    }
    list.forEach(m => {
        const item = document.createElement('div');
        item.className = 'mecha-search-item';
        item.innerHTML = `<span>[No.${m.no}] <strong>${m.name}</strong></span> <span style="color:var(--accent);">HP: ${m.hp} / コスト: ${m.cost}</span>`;
        item.onclick = () => selectMecha(m);
        container.appendChild(item);
    });
}

function selectMecha(m) {
    const ev = events.find(e => e.id === currentEventId);
    if (editingRowIndex !== null && ev.tactics[editingRowIndex]) {
        const row = ev.tactics[editingRowIndex];
        row.mecha = m.name;
        row.hp = m.hp;
        const playerRank = ev.members[row.player] ? ev.members[row.player].rank : null;
        const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
        row.actualCost = m.cost + addCost;

        renderTacticsTable(ev);
    }
    closeModal();
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
        totalHp += hpVal; // 全行の実HP計

        const mechaData = MECHA_DB[r.mecha] || { cost: 0, hp: 0 };
        const playerRank = ev.members[r.player] ? ev.members[r.player].rank : null;
        const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
        const calcC = (r.mecha ? mechaData.cost : 0) + addCost;
        const actualC = r.actualCost !== undefined ? Number(r.actualCost) : calcC;

        // 全行の目安コスト計
        totalCalcCost += calcC;
        // 全行のDB HP計
        totalDbHpAll += Number(mechaData.hp || 0);
        // 全行の実コスト計
        totalActualCostAll += actualC;

        if (r.reg) {
            regCount++;
            checkedHp += hpVal; // 登録済行の実HP計
            totalActualCost += actualC; // 登録済行の実コスト計
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
    
    // [目安] 全行集計
    document.getElementById('stat-cost').innerText = totalCalcCost.toLocaleString();
    document.getElementById('stat-db-hp').innerText = totalDbHpAll.toLocaleString();

    // [実合計] 全行集計
    document.getElementById('stat-actual-cost-total').innerText = totalActualCostAll.toLocaleString();
    document.getElementById('stat-total-hp').innerText = totalHp.toLocaleString();

    // [登録済] 登録フラグON行のみ集計
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

// 【作戦要点サマリタブ】参加メンバー全員分のカードを生成し、作戦立案タブの内容と連動させる
function renderSummaryCards() {
    const evData = events.find(e => e.id === currentEventId);
    if (!evData) return;

    const container = document.getElementById('summary-cards');
    container.innerHTML = '';

    const memberNames = Object.keys(evData.members);
    
    if (memberNames.length === 0) {
        container.innerHTML = '<p class="sub-title">登録されている参加メンバーがいません。</p>';
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
                        <div style="margin-top: 4px; color: var(--text-muted); font-size: 0.8rem;">
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
