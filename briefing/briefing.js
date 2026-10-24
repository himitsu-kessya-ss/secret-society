let currentEventId = null;
let MECHA_DB = {}; // 機体データベース（CSV全行保持: { name, hp, cost, rowNo }）
let mechaListArray = []; // 検索用配列
let editingRowIndex = null; // 機体検索モーダルで編集中行のインデックス

// 階級マスタ (全45段階)
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

// 特性マスタ (全55種)
const TRAIT_MASTER = [
    "豪胆", "豪快", "冷酷", "清涼", "短気", "熱血", "半端", "凡庸", "沈着", "策士",
    "迅速", "機転", "冷静", "傲慢", "一途", "暴走", "不屈", "執念", "配慮", "倹約",
    "強欲", "流行", "脱力", "頑丈", "感応", "器用", "集中", "気弱", "悪戯", "実直",
    "節約", "陶酔", "偏屈", "悪運", "冷血", "鈍感", "偵察", "覚醒", "再生", "闘志",
    "威圧", "鍛錬", "一徹", "威風", "堅実", "明朗", "繊細", "高尚", "闘争"
];

const TACTICS_MASTER = ["NS", "AS", "DS", "SS", "NA", "AA", "DA", "SA", "ND", "AD", "DD", "SD", "LA", "LD", "LS"];
const DEFAULT_PLAYERS = ["Oro🍊min", "Halbert", "Yggdrasill", "スパイク", "キッド", "ボブ", "リーア", "ハチワレ", "ナイト"];

let events = [];

// ローカルストレージキー
const STORAGE_KEY = 'secret_society_briefing_events_v2';

window.onload = async function() {
    await loadMechaCsv();
    loadEventsFromStorage();
    renderEventList();
};

// LocalStorage からデータ読み込み
function loadEventsFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            events = JSON.parse(saved);
        } catch(e) {
            console.error("データパース失敗", e);
            initDefaultEvents();
        }
    } else {
        initDefaultEvents();
    }
}

function initDefaultEvents() {
    events = [
        { id: 'ev1', title: '26.10 勢力戦', pass: '1234', members: {}, tactics: [] }
    ];
    initDefaultEventData(events[0]);
    saveEventsToStorage();
}

// LocalStorage へデータ保存
function saveEventsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

// CSV読み込み関数 (1列目: 番号, 2列目: 機体名, 4列目: HP, 18列目: コスト)
async function loadMechaCsv() {
    try {
        const response = await fetch('GL)機体一覧 - 機体一覧.csv');
        if (!response.ok) throw new Error('CSV読み込み失敗');
        const csvText = await response.text();
        const lines = csvText.split('\n');

        MECHA_DB = {};
        mechaListArray = [];

        lines.forEach((line, idx) => {
            if (!line.trim()) return;
            const cols = line.split(',').map(col => col.replace(/^"|"$/g, '').trim());

            if (cols.length >= 18) {
                const rowNo = idx + 1;
                const mechaName = cols[1];
                const hpVal = Number(cols[3]) || 0;
                const costVal = Number(cols[17]) || 0;

                if (mechaName) {
                    MECHA_DB[mechaName] = { hp: hpVal, cost: costVal, rowNo: rowNo };
                    mechaListArray.push({ name: mechaName, hp: hpVal, cost: costVal, rowNo: rowNo });
                }
            }
        });
        console.log("機体CSV読み込み完了:", mechaListArray.length + "件");
    } catch (err) {
        console.warn("CSV読み込みエラー。フォールバック使用", err);
        MECHA_DB = {
            "ガンダム": { hp: 384, cost: 38, rowNo: 1 },
            "バンシィ": { hp: 576, cost: 64, rowNo: 2 },
            "ガリルナガン": { hp: 700, cost: 72, rowNo: 3 }
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
        { reg: true, tactic: "DA", turn: 10, player: "Oro🍊min", mecha: "ガンダム", hp: 501, weapon: "★フルバースト", minR: 20, maxR: 70, equip: "プロペラントタンク", str: "移動しない攻撃", 
          t1: "集中", l1: 10, t2: "機転", l2: 10, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
          c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0 },
        { reg: true, tactic: "DA", turn: 1, player: "Yggdrasill", mecha: "ガリルナガン", hp: 696, weapon: "アキシオン・アッシャー", minR: 50, maxR: 90, equip: "プロペラントタンク", str: "足止め攻撃", 
          t1: "集中", l1: 10, t2: "繊細", l2: 10, t3: "偵察", l3: 7, t4: "", l4: 0, t5: "", l5: 0, 
          c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0 }
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
    saveEventsToStorage();
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
    document.getElementById('page-briefing-room').classList.add('hidden');
    document.getElementById('page-event-sheet').classList.remove('hidden');
    document.getElementById('btn-back-main').classList.remove('hidden');

    document.getElementById('sheet-event-title').innerText = ev.title;
    document.getElementById('sheet-event-desc').innerText = `イベントID: ${ev.id} | 作戦共有中 (自動保存有効)`;

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

// メンバー管理
function renderMemberTable(ev) {
    const tbody = document.getElementById('tbody-members');
    tbody.innerHTML = '';

    Object.keys(ev.members).forEach(pName => {
        const m = ev.members[pName];
        const rankCost = RANK_MASTER[m.rank] || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${pName}" onchange="renameMember('${pName}', this.value)" style="width:120px;"></td>
            <td><input type="number" value="${m.exp}" onchange="ev.members['${pName}'].exp = Number(this.value); saveEventsToStorage();"></td>
            <td>
                <select onchange="updateMemberRank('${pName}', this.value)" style="width:130px;">
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
    saveEventsToStorage();
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
    saveEventsToStorage();
    renderMemberTable(ev);
}

function deleteMember(pName) {
    const ev = events.find(e => e.id === currentEventId);
    delete ev.members[pName];
    saveEventsToStorage();
    renderMemberTable(ev);
}

function updateMemberRank(pName, newRank) {
    const ev = events.find(e => e.id === currentEventId);
    ev.members[pName].rank = newRank;
    saveEventsToStorage();
    renderMemberTable(ev);
    renderTacticsTable(ev);
}

// 作戦テーブル描画
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
        reg: false, tactic: "AA", turn: 1, player: "", mecha: "", hp: 0, weapon: "", minR: 0, maxR: 20, equip: "", str: "", 
        t1: "", l1: 0, t2: "", l2: 0, t3: "", l3: 0, t4: "", l4: 0, t5: "", l5: 0, 
        c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, r1:0, r2:0, r3:0
    });
    saveEventsToStorage();
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

    // 団体戦術の役割別カラークラス判定 (後ろの文字: A, D, S)
    let tacticClass = "";
    if (row.tactic) {
        const lastChar = row.tactic.slice(-1).toUpperCase();
        if (lastChar === 'A') tacticClass = "tactic-a";
        else if (lastChar === 'D') tacticClass = "tactic-d";
        else if (lastChar === 'S') tacticClass = "tactic-s";
    }

    // 特性のプルダウンHTML生成ヘルパー
    const traitSelectHtml = (selectedVal) => `
        <select class="trait-select" onchange="updateTrait('${no-1}', '${selectedVal}', this.value)">
            <option value="">(なし)</option>
            ${TRAIT_MASTER.map(t => `<option value="${t}" ${t === selectedVal ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
    `;

    // 0〜10のLVプルダウン生成ヘルパー
    const lvSelectHtml = (selectedLv, traitKey) => `
        <select class="trait-lv-select" onchange="updateTraitLv('${no-1}', '${traitKey}', this.value)">
            ${[...Array(11)].map((_, i) => `<option value="${i}" ${Number(selectedLv) === i ? 'selected' : ''}>Lv${i}</option>`).join('')}
        </select>
    `;

    tr.innerHTML = `
        <td><input type="checkbox" ${row.reg ? 'checked' : ''} onchange="row.reg = this.checked; saveEventsToStorage(); calculateStats();"></td>
        <td>${no}</td>
        <td>
            <select class="${tacticClass}" onchange="row.tactic = this.value; saveEventsToStorage(); renderTacticsTable(ev);">
                ${TACTICS_MASTER.map(t => `<option value="${t}" ${t === row.tactic ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" value="${row.turn}" style="width:50px;" onchange="row.turn = Number(this.value); saveEventsToStorage();"></td>
        <td>
            <select onchange="row.player = this.value; saveEventsToStorage(); renderTacticsTable(ev);" style="width:120px;">
                <option value="">選択</option>
                ${Object.keys(ev.members).map(p => `<option value="${p}" ${p === row.player ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </td>
        <td style="color:var(--accent); font-weight:bold;">${calcCost || '#N/A'}</td>
        <td>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.8rem; width:100%; text-align:left; overflow:hidden; text-overflow:ellipsis;" onclick="openMechaSearchModal(${no-1})">
                ${row.mecha || '機体を検索...'}
            </button>
        </td>
        <td>${dbCost}</td>
        <td>${dbHp}</td>
        <td><input type="number" value="${row.hp || (mechaData.hp || 0)}" style="width:65px;" onchange="row.hp = Number(this.value); saveEventsToStorage(); calculateStats();"></td>
        <td><input type="text" value="${row.weapon}" onchange="row.weapon = this.value; saveEventsToStorage();" style="width:130px;"></td>
        <td><input type="number" min="0" max="99" value="${row.minR}" style="width:50px;" onchange="row.minR = Number(this.value); saveEventsToStorage(); renderTacticsTable(ev);"></td>
        <td><input type="number" min="0" max="99" value="${row.maxR}" style="width:50px;" onchange="row.maxR = Number(this.value); saveEventsToStorage(); renderTacticsTable(ev);"></td>
        <td>
            <div class="range-bar-container">
                <div class="range-bar-fill" style="left: ${Math.min(100, Math.max(0, row.minR))}%; width: ${Math.max(0, Math.min(100 - row.minR, row.maxR - row.minR))}%;"></div>
            </div>
        </td>
        <td><input type="text" value="${row.equip}" onchange="row.equip = this.value; saveEventsToStorage();" style="width:110px;"></td>
        <td><input type="text" value="${row.str}" onchange="row.str = this.value; saveEventsToStorage();" style="width:110px;"></td>
        
        <!-- 特性1〜5 と それぞれのLV -->
        <td>${traitSelectHtml(row.t1)} ${lvSelectHtml(row.l1, 'l1')}</td>
        <td>${traitSelectHtml(row.t2)} ${lvSelectHtml(row.l2, 'l2')}</td>
        <td>${traitSelectHtml(row.t3)} ${lvSelectHtml(row.l3, 'l3')}</td>
        <td>${traitSelectHtml(row.t4)} ${lvSelectHtml(row.l4, 'l4')}</td>
        <td>${traitSelectHtml(row.t5)} ${lvSelectHtml(row.l5, 'l5')}</td>

        ${[...Array(8)].map((_, i) => `<td><input type="number" value="${row['c'+(i+1)] || 0}" style="width:38px;" onchange="row.c${i+1} = Number(this.value); saveEventsToStorage();"></td>`).join('')}
        ${[...Array(3)].map((_, i) => `<td><input type="number" value="${row['r'+(i+1)] || 0}" style="width:38px;" onchange="row.r${i+1} = Number(this.value); saveEventsToStorage();"></td>`).join('')}
    `;

    return tr;
}

// 特性変更ハンドラ
function updateTrait(rowIndex, oldVal, newVal) {
    const ev = events.find(e => e.id === currentEventId);
    const row = ev.tactics[rowIndex];
    if (row.t1 === oldVal) row.t1 = newVal;
    else if (row.t2 === oldVal) row.t2 = newVal;
    else if (row.t3 === oldVal) row.t3 = newVal;
    else if (row.t4 === oldVal) row.t4 = newVal;
    else if (row.t5 === oldVal) row.t5 = newVal;
    else {
        // 空いてるところにセット
        if (!row.t1) row.t1 = newVal;
        else if (!row.t2) row.t2 = newVal;
        else if (!row.t3) row.t3 = newVal;
        else if (!row.t4) row.t4 = newVal;
        else if (!row.t5) row.t5 = newVal;
    }
    saveEventsToStorage();
}

function updateTraitLv(rowIndex, lvKey, val) {
    const ev = events.find(e => e.id === currentEventId);
    ev.tactics[rowIndex][lvKey] = Number(val);
    saveEventsToStorage();
}

// 機体検索モーダル関連
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
        m.name.toLowerCase().includes(query) || String(m.rowNo).includes(query)
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
        item.innerHTML = `<span>[No.${m.rowNo}] <strong>${m.name}</strong></span> <span style="color:var(--accent);">HP: ${m.hp} / コスト: ${m.cost}</span>`;
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
        saveEventsToStorage();
        renderTacticsTable(ev);
    }
    closeModal();
}

// 統計データ計算（登録チェック別HP、総合計HP、合計コスト）
function calculateStats() {
    const ev = events.find(e => e.id === currentEventId);
    if (!ev) return;

    let count = 0, checkedHp = 0, totalHp = 0, totalCost = 0;

    ev.tactics.forEach(r => {
        const hpVal = Number(r.hp || 0);
        totalHp += hpVal;

        if (r.reg) {
            count++;
            checkedHp += hpVal;
            const mechaData = MECHA_DB[r.mecha] || { cost: 0 };
            const playerRank = ev.members[r.player] ? ev.members[r.player].rank : null;
            const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
            totalCost += (r.mecha ? mechaData.cost : 0) + addCost;
        }
    });

    document.getElementById('stat-count').innerText = count;
    document.getElementById('stat-hp').innerText = checkedHp.toLocaleString();
    document.getElementById('stat-total-hp').innerText = totalHp.toLocaleString();
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
        const traitsStr = [
            r.t1 ? `${r.t1}(Lv${r.l1})` : '',
            r.t2 ? `${r.t2}(Lv${r.l2})` : '',
            r.t3 ? `${r.t3}(Lv${r.l3})` : '',
            r.t4 ? `${r.t4}(Lv${r.l4})` : '',
            r.t5 ? `${r.t5}(Lv${r.l5})` : ''
        ].filter(Boolean).join(', ');

        card.innerHTML = `
            <div class="summary-header">
                <span>${r.player || '未設定'} (${r.tactic})</span>
                <span>登場 T: ${r.turn}</span>
            </div>
            <div><strong>機体:</strong> ${r.mecha || '-'} (HP: ${r.hp})</div>
            <div><strong>武装:</strong> ${r.weapon || '-'} (射程: ${r.minR}〜${r.maxR})</div>
            <div><strong>装備:</strong> ${r.equip || '-'}</div>
            <div style="margin-top:8px; color:var(--text-muted); font-size:0.8rem;">
                個人戦術: ${r.str || '-'}<br>
                特性: ${traitsStr || '-'}
            </div>
        `;
        container.appendChild(card);
    });
}
