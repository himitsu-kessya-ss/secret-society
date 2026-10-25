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

    // 5秒おきにスプレッドシートから最新データを自動取得して同期
    setInterval(async () => {
        if (GAS_URL) {
            await loadEventsFromServer(true); 
        }
    }, 5000);
};

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
        }
    } else {
        if (currentEventId) {
            const ev = events.find(ev => ev.id === currentEventId);
            if (ev) {
                calculateStats();
            }
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
        { reg: true, tactic: "DA", actualCost: 38, turn: 10, player: "Oro🍊min", mecha: "ガンダム", hp: 501, weapon: "★フルバースト", minR: 20, maxR: 70, equip: "プロペラントタンク", strPre: "移動しない", strPost: "攻撃", 
          t1: "集中", l1: 10, t2: "機転", l2: 10, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
          c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0 },
        { reg: true, tactic: "DA", actualCost: 72, turn: 1, player: "Yggdrasill", mecha: "ガリルナガン", hp: 696, weapon: "アキシオン・アッシャー", minR: 50, maxR: 90, equip: "プロペラントタンク", strPre: "足止め", strPost: "回避", 
          t1: "集中", l1: 10, t2: "繊細", l2: 10, t3: "偵察", l3: 7, t4: "", l4: 0, t5: "", l5: 0, 
          c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0 }
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

    document.getElementById('sheet-event-title').innerText = ev.title;
    document.getElementById('sheet-event-desc').innerText = `イベントID: ${ev.id} | スプレッドシート同期中`;

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

// 参加メンバー一覧テーブルの描画（入力中に再描画されて消えないよう最適化）
function renderMemberTable(ev) {
    const tbody = document.getElementById('tbody-members');
    tbody.innerHTML = '';

    Object.keys(ev.members).forEach(pName => {
        const m = ev.members[pName];
        const rankCost = RANK_MASTER[m.rank] || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${pName}" data-oldname="${pName}" class="member-name-input" style="width:120px;"></td>
            <td><input type="number" value="${m.exp}" data-player="${pName}" class="member-exp-input" style="width:70px;"></td>
            <td>
                <select data-player="${pName}" class="member-rank-select" style="width:130px;">
                    ${Object.keys(RANK_MASTER).map(r => `<option value="${r}" ${r === m.rank ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
            </td>
            <td style="color:var(--accent); font-weight:bold;" class="member-cost-cell">+${rankCost}</td>
            <td><button class="btn btn-danger" style="padding: 2px 8px; font-size:0.75rem;" onclick="deleteMember('${pName}')">削除</button></td>
        `;
        tbody.appendChild(tr);
    });

    // 各入力フィールドのイベントリスナーを設定（入力中に画面が再描画されないようにする）
    tbody.querySelectorAll('.member-name-input').forEach(input => {
        input.oninput = function() {
            const oldName = this.dataset.oldname;
            const newName = this.value;
            const ev = events.find(e => e.id === currentEventId);
            if (!newName || ev.members[newName]) return;

            // データのキーを付け替え
            ev.members[newName] = ev.members[oldName];
            delete ev.members[oldName];
            this.dataset.oldname = newName;

            // 関連する戦術行のプレイヤー名も更新
            ev.tactics.forEach(t => { if(t.player === oldName) t.player = newName; });
            saveEventsToServer();
        };
    });

    tbody.querySelectorAll('.member-exp-input').forEach(input => {
        input.oninput = function() {
            const pName = this.dataset.player;
            const ev = events.find(e => e.id === currentEventId);
            if (ev && ev.members[pName]) {
                ev.members[pName].exp = Number(this.value);
                saveEventsToServer();
                calculateStats();
            }
        };
    });

    tbody.querySelectorAll('.member-rank-select').forEach(select => {
        select.onchange = function() {
            const pName = this.dataset.player;
            const newRank = this.value;
            const ev = events.find(e => e.id === currentEventId);
            if (ev && ev.members[pName]) {
                ev.members[pName].rank = newRank;
                saveEventsToServer();
                // 階級変更時のみコスト表示を更新するため再描画
                renderMemberTable(ev);
                renderTacticsTable(ev);
            }
        };
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
    saveEventsToServer();
    renderMemberTable(ev);
}

function deleteMember(pName) {
    const ev = events.find(e => e.id === currentEventId);
    delete ev.members[pName];
    saveEventsToServer();
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
        reg: false, tactic: "AA", actualCost: 0, turn: 1, player: "", mecha: "", hp: 0, weapon: "", minR: 0, maxR: 20, equip: "", 
        strPre: "移動", strPost: "攻撃", 
        t1: "", l1: 0, t2: "", l2: 0, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
        c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0
    });
    saveEventsToServer();
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

    let tacticClass = "";
    if (row.tactic) {
        const lastChar = row.tactic.slice(-1).toUpperCase();
        if (lastChar === 'A') tacticClass = "tactic-a";
        else if (lastChar === 'D') tacticClass = "tactic-d";
        else if (lastChar === 'S') tacticClass = "tactic-s";
    }

    const traitSelectHtml = (selectedVal, traitIndex) => `
        <select class="trait-select" onchange="updateTrait(${no-1}, ${traitIndex}, this.value)">
            <option value="">(なし)</option>
            ${TRAIT_MASTER.map(t => `<option value="${t}" ${t === selectedVal ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
    `;

    const lvSelectHtml = (selectedLv, lvKey) => `
        <select class="trait-lv-select" onchange="updateTraitLv(${no-1}, '${lvKey}', this.value)">
            ${[...Array(11)].map((_, i) => `<option value="${i}" ${Number(selectedLv) === i ? 'selected' : ''}>${i === 0 ? '0' : i}</option>`).join('')}
        </select>
    `;

    tr.innerHTML = `
        <td><input type="checkbox" ${row.reg ? 'checked' : ''} onchange="row.reg = this.checked; saveEventsToServer(); calculateStats();"></td>
        <td>${no}</td>
        <td>
            <select class="${tacticClass}" onchange="changeTactic(this, ${no-1})">
                ${TACTICS_MASTER.map(t => `<option value="${t}" ${t === row.tactic ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" value="${row.turn}" style="width:50px;" oninput="row.turn = Number(this.value); saveEventsToServer();"></td>
        <td>
            <select onchange="row.player = this.value; saveEventsToServer(); calculateStats();" style="width:120px;">
                <option value="">選択</option>
                ${Object.keys(ev.members).map(p => `<option value="${p}" ${p === row.player ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </td>
        <td style="color:var(--accent); font-weight:bold;">${calcCost || '#N/A'}</td>
        <td><input type="number" value="${row.actualCost !== undefined ? row.actualCost : calcCost}" style="width:65px;" oninput="row.actualCost = Number(this.value); saveEventsToServer(); calculateStats();"></td>
        <td>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.8rem; width:100%; text-align:left; overflow:hidden; text-overflow:ellipsis;" onclick="openMechaSearchModal(${no-1})">
                ${row.mecha || '機体を検索...'}
            </button>
        </td>
        <td>${dbCost}</td>
        <td>${dbHp}</td>
        <td><input type="number" value="${row.hp || (mechaData.hp || 0)}" style="width:65px;" oninput="row.hp = Number(this.value); saveEventsToServer(); calculateStats();"></td>
        <td><input type="text" class="weapon-input" value="${row.weapon}" oninput="row.weapon = this.value; saveEventsToServer();"></td>
        
        <td><input type="number" min="0" max="99" value="${row.minR}" style="width:50px;" oninput="updateRangeBar(this, ${no-1}, 'min')"></td>
        <td><input type="number" min="0" max="99" value="${row.maxR}" style="width:50px;" oninput="updateRangeBar(this, ${no-1}, 'max')"></td>
        <td>
            <div class="range-bar-container" id="range-bar-${no-1}">
                <div class="range-bar-fill" style="left: ${Math.min(100, Math.max(0, row.minR))}%; width: ${Math.max(0, Math.min(100 - row.minR, row.maxR - row.minR))}%;"></div>
            </div>
        </td>

        <td><input type="text" class="equip-input" value="${row.equip}" oninput="row.equip = this.value; saveEventsToServer();"></td>
        
        <td>
            <select class="strategy-select" onchange="row.strPre = this.value; saveEventsToServer();">
                ${STRATEGY_PRE_MASTER.map(s => `<option value="${s}" ${s === row.strPre ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </td>
        <td>
            <select class="strategy-select" onchange="row.strPost = this.value; saveEventsToServer();">
                ${STRATEGY_POST_MASTER.map(s => `<option value="${s}" ${s === row.strPost ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </td>

        <td>${traitSelectHtml(row.t1, 1)} ${lvSelectHtml(row.l1, 'l1')}</td>
        <td>${traitSelectHtml(row.t2, 2)} ${lvSelectHtml(row.l2, 'l2')}</td>
        <td>${traitSelectHtml(row.t3, 3)} ${lvSelectHtml(row.l3, 'l3')}</td>
        <td>${traitSelectHtml(row.t4, 4)} ${lvSelectHtml(row.l4, 'l4')}</td>
        <td>${traitSelectHtml(row.t5, 5)} ${lvSelectHtml(row.l5, 'l5')}</td>

        ${[...Array(8)].map((_, i) => `<td><input type="number" value="${row['c'+(i+1)] || 0}" style="width:38px;" oninput="row.c${i+1} = Number(this.value); saveEventsToServer(); calculateStats();"></td>`).join('')}
        ${[...Array(3)].map((_, i) => `<td><input type="number" value="${row['r'+(i+1)] || 0}" style="width:38px;" oninput="row.r${i+1} = Number(this.value); saveEventsToServer(); calculateStats();"></td>`).join('')}
    `;

    return tr;
}

function changeTactic(selectEl, rowIndex) {
    const ev = events.find(e => e.id === currentEventId);
    const val = selectEl.value;
    ev.tactics[rowIndex].tactic = val;
    saveEventsToServer();

    selectEl.className = "";
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
    
    saveEventsToServer();

    const barFill = tr.querySelector('.range-bar-fill');
    if (barFill) {
        const min = Math.min(100, Math.max(0, row.minR));
        const max = Math.max(0, Math.min(100, row.maxR));
        barFill.style.left = min + '%';
        barFill.style.width = Math.max(0, max - min) + '%';
    }
}

function updateTrait(rowIndex, traitNum, newVal) {
    const ev = events.find(e => e.id === currentEventId);
    const row = ev.tactics[rowIndex];
    if (traitNum === 1) row.t1 = newVal;
    if (traitNum === 2) row.t2 = newVal;
    if (traitNum === 3) row.t3 = newVal;
    if (traitNum === 4) row.t4 = newVal;
    if (traitNum === 5) row.t5 = newVal;
    saveEventsToServer();
}

function updateTraitLv(rowIndex, lvKey, val) {
    const ev = events.find(e => e.id === currentEventId);
    ev.tactics[rowIndex][lvKey] = Number(val);
    saveEventsToServer();
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

        saveEventsToServer();
        renderTacticsTable(ev);
    }
    closeModal();
}

function calculateStats() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    let count = 0, checkedHp = 0, totalHp = 0, totalCalcCost = 0, totalActualCost = 0;
    
    let sumCols = {};
    for(let i=1; i<=8; i++) sumCols['c'+i] = 0;
    for(let i=1; i<=3; i++) sumCols['r'+i] = 0;

    ev.tactics.forEach(r => {
        const hpVal = Number(r.hp || 0);
        totalHp += hpVal;

        const mechaData = MECHA_DB[r.mecha] || { cost: 0 };
        const playerRank = ev.members[r.player] ? ev.members[r.player].rank : null;
        const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
        const calcC = (r.mecha ? mechaData.cost : 0) + addCost;
        const actualC = r.actualCost !== undefined ? Number(r.actualCost) : calcC;

        if (r.reg) {
            count++;
            checkedHp += hpVal;
            totalCalcCost += calcC;
            totalActualCost += actualC;
        }

        for(let i=1; i<=8; i++) sumCols['c'+i] += Number(r['c'+i] || 0);
        for(let i=1; i<=3; i++) sumCols['r'+i] += Number(r['r'+i] || 0);
    });

    document.getElementById('stat-count').innerText = count;
    document.getElementById('stat-hp').innerText = checkedHp.toLocaleString();
    document.getElementById('stat-total-hp').innerText = totalHp.toLocaleString();
    document.getElementById('stat-cost').innerText = totalCalcCost.toLocaleString();

    const tfoot = document.getElementById('tfoot-tactics');
    tfoot.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: right; padding-right: 15px;">合計値：</td>
            <td>${totalCalcCost.toLocaleString()}</td>
            <td>${totalActualCost.toLocaleString()}</td>
            <td colspan="3"></td>
            <td>${totalHp.toLocaleString()}</td>
            <td colspan="13"></td>
            ${[...Array(8)].map((_, i) => `<td>${sumCols['c'+(i+1)].toLocaleString()}</td>`).join('')}
            ${[...Array(3)].map((_, i) => `<td>${sumCols['r'+(i+1)].toLocaleString()}</td>`).join('')}
        </tr>
    `;
}

function renderSummaryCards() {
    const evData = events.find(e => e.id === currentEventId);
    if (!evData) return;

    const container = document.getElementById('summary-cards');
    container.innerHTML = '';

    const activeRows = evData.tactics.filter(r => r.reg);
    if (activeRows.length === 0) {
        container.innerHTML = '<p class="sub-title">登録にチェックが入っている機体がありません。</p>';
        return;
    }

    activeRows.forEach(r => {
        const card = document.createElement('div');
        card.className = 'summary-item-card';
        const traitsStr = [
            r.t1 ? `${r.t1}(${r.l1})` : '',
            r.t2 ? `${r.t2}(${r.l2})` : '',
            r.t3 ? `${r.t3}(${r.l3})` : '',
            r.t4 ? `${r.t4}(${r.l4})` : '',
            r.t5 ? `${r.t5}(${r.l5})` : ''
        ].filter(Boolean).join(', ');

        card.innerHTML = `
            <div class="summary-header">
                <span>${r.player || '未設定'} (${r.tactic})</span>
                <span>登場 T: ${r.turn}</span>
            </div>
            <div><strong>機体:</strong> ${r.mecha || '-'} (実HP: ${r.hp})</div>
            <div><strong>武装:</strong> ${r.weapon || '-'} (射程: ${r.minR}〜${r.maxR})</div>
            <div><strong>装備:</strong> ${r.equip || '-'}</div>
            <div style="margin-top:8px; color:var(--text-muted); font-size:0.8rem;">
                個人戦術: ${r.strPre || '-'} / ${r.strPost || '-'}<br>
                特性: ${traitsStr || '-'}
            </div>
        `;
        container.appendChild(card);
    });
}
