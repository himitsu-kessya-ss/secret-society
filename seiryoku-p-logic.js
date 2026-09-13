// ==========================================
// 秘密結社の部屋 - 勢力P管理ロジック (seiryoku-p-logic.js)
// ==========================================

function loadData(key, fallback) {
    const saved = localStorage.getItem(key);
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { return fallback; }
    }
    return fallback;
}

let membersData = loadData('seiryoku_members_v7', members);
let historyRecord = loadData('seiryoku_history_v5', historyData);
let logsData = loadData('seiryoku_logs_v5', eventLogs);

function switchTab(tabNum) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelectorAll('.tab-btn')[tabNum - 1].classList.add('active');
    document.getElementById(`tab-${tabNum}`).classList.add('active');
}

function renderTable() {
    const tbody = document.getElementById('member-tbody');
    tbody.innerHTML = '';

    let totalThisMonthAll = 0;
    let totalSeiryokuPAll = 0;
    let totalReiseiAll = 0;

    membersData.forEach((m, index) => {
        const thisMonth = Number(m.thisMonth) || 0;
        const total = Number(m.total) || 0;
        const adjustment = Number(m.adjustment) || 0;

        const calculatedReisei = Math.floor((total * 0.008) + adjustment);
        totalReiseiAll += calculatedReisei;

        totalThisMonthAll += thisMonth;
        totalSeiryokuPAll += total;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><input type="text" value="${m.name}" data-index="${index}" style="width: 150px;"></td>
            <td><input type="number" value="${m.lastMonth}" data-index="${index}"></td>
            <td><input type="number" value="${m.thisMonth}" data-index="${index}" oninput="updateCalculations()"></td>
            <td><input type="number" value="${m.total}" data-index="${index}" oninput="updateCalculations()"></td>
            <td><input type="number" value="${m.adjustment}" data-index="${index}" oninput="updateCalculations()" style="width: 80px; color: #ffeb3b;"></td>
            <td class="highlight-column" id="reisei-${index}">${calculatedReisei.toLocaleString()} 名声</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-seiryoku-p').innerText = totalSeiryokuPAll.toLocaleString() + ' P';
    document.getElementById('total-reisei').innerText = `基準名声換算: ${Math.floor(totalSeiryokuPAll * 0.008).toLocaleString()} 名声`;
    document.getElementById('total-this-month').innerText = totalThisMonthAll.toLocaleString() + ' P';
    document.getElementById('total-company-fee').innerText = `運営費プール(20%): ${Math.floor(totalThisMonthAll * 0.20).toLocaleString()} P`;

    const totalSeiryokuPoolReisei = totalSeiryokuPAll * 0.008;
    const surplusReisei = totalSeiryokuPoolReisei - totalReiseiAll;
    const surplusElement = document.getElementById('surplus-reisei');
    if (surplusElement) {
        surplusElement.innerText = `${Math.floor(surplusReisei).toLocaleString()} 名声`;
    }

    renderHistoryTables();
    renderLogsTable();
    renderLogInputsContainer();
}

function renderHistoryTables() {
    const totalThead = document.getElementById('history-total-thead');
    const totalTbody = document.getElementById('history-total-tbody');
    const monthlyThead = document.getElementById('history-monthly-thead');
    const monthlyTbody = document.getElementById('history-monthly-tbody');
    const rateThead = document.getElementById('history-rate-thead');
    const rateTbody = document.getElementById('history-rate-tbody');

    const memberHeadersHtml = membersData.map(m => `<th>${m.name}</th>`).join('');

    totalThead.innerHTML = `<tr><th>年</th><th>確認日</th><th>全合計</th>${memberHeadersHtml}</tr>`;
    monthlyThead.innerHTML = `<tr><th>年</th><th>確認日</th><th>当月獲得値</th>${memberHeadersHtml}</tr>`;
    rateThead.innerHTML = `<tr><th>年</th><th>確認日</th><th>列 1</th>${memberHeadersHtml}</tr>`;

    totalTbody.innerHTML = '';
    monthlyTbody.innerHTML = '';
    rateTbody.innerHTML = '';

    historyRecord.forEach(h => {
        let tr1 = document.createElement('tr');
        tr1.innerHTML = `<td>${h.year}</td><td>${h.date}</td><td style="font-weight:bold; color:var(--accent-color);">${h.totalP.toLocaleString()}</td>` +
            h.members.map(val => `<td>${(Number(val) || 0).toLocaleString()}</td>`).join('');
        totalTbody.appendChild(tr1);

        let tr2 = document.createElement('tr');
        tr2.innerHTML = `<td>${h.year}</td><td>${h.date}</td><td style="font-weight:bold; color:#99ff99;">${h.monthlyP.toLocaleString()}</td>` +
            h.members.map(val => `<td>${(Number(val) || 0).toLocaleString()}</td>`).join('');
        monthlyTbody.appendChild(tr2);

        let tr3 = document.createElement('tr');
        let rateCells = h.members.map(val => {
            const numVal = Number(val) || 0;
            const percentage = h.monthlyP > 0 ? ((numVal / h.monthlyP) * 100).toFixed(1) : "0.0";
            return `<td>${percentage}</td>`;
        }).join('');
        tr3.innerHTML = `<td>${h.year}</td><td>${h.date}</td><td>100.0</td>` + rateCells;
        rateTbody.appendChild(tr3);
    });
}

function renderLogInputsContainer() {
    const container = document.getElementById('log-member-inputs');
    if (!container) return;
    container.innerHTML = '';

    membersData.forEach((m, index) => {
        const div = document.createElement('div');
        div.style.cssText = "display: flex; flex-direction: column; align-items: center; background: #1a1c1e; padding: 6px; border-radius: 4px; border: 1px solid #333; min-width: 80px;";
        div.innerHTML = `
            <span style="font-size: 0.75rem; color: var(--sub-text); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;" title="${m.name}">${m.name}</span>
            <input type="number" class="log-member-val" data-member-index="${index}" value="0" style="width: 60px; text-align: center;">
        `;
        container.appendChild(div);
    });
}

function renderLogsTable() {
    const thead = document.getElementById('logs-thead');
    const tbody = document.getElementById('logs-tbody');
    if (!thead || !tbody) return;

    let memberHeadersHtml = membersData.map(m => `<th style="text-align: center; min-width: 90px;">${m.name}</th>`).join('');
    thead.innerHTML = `
        <tr>
            <th style="width: 110px;">日付</th>
            ${memberHeadersHtml}
            <th style="min-width: 150px; text-align: left;">memo</th>
            <th style="width: 110px; text-align: center;">操作</th>
        </tr>
    `;

    tbody.innerHTML = '';

    logsData.forEach((log, logIndex) => {
        let memberCellsHtml = "";
        membersData.forEach((_, idx) => {
            const val = log.values && log.values[idx] !== undefined ? log.values[idx] : 0;
            const displayVal = val !== 0 ? val : "";
            const colorStyle = val > 0 ? "color: #99ff99;" : (val < 0 ? "color: #ff8080;" : "color: #888;");
            memberCellsHtml += `<td style="text-align: center; ${colorStyle} font-weight: bold;" class="log-cell-${logIndex}" data-col="${idx}">${displayVal}</td>`;
        });

        const tr = document.createElement('tr');
        tr.id = `log-row-${logIndex}`;
        tr.innerHTML = `
            <td style="white-space: nowrap; color: var(--sub-text);" class="log-date-cell">${log.date}</td>
            ${memberCellsHtml}
            <td style="color: var(--accent-color); font-weight: bold;" class="log-memo-cell">${log.memo || ""}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn-small" onclick="editLog(${logIndex})" id="edit-btn-${logIndex}" style="padding: 3px 8px; font-size: 0.75rem; background: #333; color: #fff; border: 1px solid #555; border-radius: 3px; cursor: pointer; margin-right: 4px;">編集</button>
                <button class="btn-small" onclick="deleteLog(${logIndex})" style="padding: 3px 8px; font-size: 0.75rem; background: #4a1515; color: #ff9999; border: 1px solid #662222; border-radius: 3px; cursor: pointer;">削除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ログの追加
function addEventLog() {
    const dateInput = document.getElementById('log-date').value;
    const memoInput = document.getElementById('log-memo').value;

    if (!dateInput || !memoInput) {
        alert("日付とmemo（理由）は必ず入力してください。");
        return;
    }

    const valueInputs = document.querySelectorAll('.log-member-val');
    let memberValues = [];
    valueInputs.forEach(input => {
        memberValues.push(Number(input.value) || 0);
    });

    logsData.unshift({
        date: dateInput,
        memo: memoInput,
        values: memberValues
    });

    renderLogsTable();
    alert("イベントログを追加しました。「変更を保存する」を押して保存してください。");
}

// ログの削除
function deleteLog(logIndex) {
    if (confirm(`「${logsData[logIndex].memo}（${logsData[logIndex].date}）」のログを本当に削除しますか？`)) {
        logsData.splice(logIndex, 1);
        renderLogsTable();
        alert("ログを削除しました。「変更を保存する」を押して確定してください。");
    }
}

// ログの編集モード切り替え & 保存
function editLog(logIndex) {
    const row = document.getElementById(`log-row-${logIndex}`);
    const editBtn = document.getElementById(`edit-btn-${logIndex}`);
    const log = logsData[logIndex];

    if (editBtn.innerText === "編集") {
        // --- 編集モードへ切替 ---
        editBtn.innerText = "保存";
        editBtn.style.background = "#005c8a";
        editBtn.style.borderColor = "#00d4ff";

        // 日付セルをinputに
        const dateCell = row.querySelector('.log-date-cell');
        dateCell.innerHTML = `<input type="date" id="edit-date-${logIndex}" value="${log.date}" style="width: 110px;">`;

        // Memoセルをinputに
        const memoCell = row.querySelector('.log-memo-cell');
        memoCell.innerHTML = `<input type="text" id="edit-memo-${logIndex}" value="${log.memo}" style="width: 140px;">`;

        // メンバー数値セルをすべてinputに
        membersData.forEach((_, idx) => {
            const cell = row.querySelector(`.log-cell-${logIndex}[data-col="${idx}"]`);
            const currentVal = log.values && log.values[idx] !== undefined ? log.values[idx] : 0;
            cell.innerHTML = `<input type="number" class="edit-val-${logIndex}" data-col="${idx}" value="${currentVal}" style="width: 60px; text-align: center;">`;
        });

    } else {
        // --- 編集内容を保存 ---
        const newDate = document.getElementById(`edit-date-${logIndex}`).value;
        const newMemo = document.getElementById(`edit-memo-${logIndex}`).value;

        if (!newDate || !newMemo) {
            alert("日付とmemoは空にできません。");
            return;
        }

        let newValues = [];
        membersData.forEach((_, idx) => {
            const inputVal = row.querySelector(`.edit-val-${logIndex}[data-col="${idx}"]`).value;
            newValues.push(Number(inputVal) || 0);
        });

        logsData[logIndex] = {
            date: newDate,
            memo: newMemo,
            values: newValues
        };

        renderLogsTable();
        alert("ログを更新しました。「変更を保存する」を押して保存してください。");
    }
}

function gatherInputData() {
    const rows = document.querySelectorAll('#member-tbody tr');
    let totalReiseiAll = 0;
    let totalSeiryokuPAll = 0;

    rows.forEach((row, index) => {
        const inputs = row.querySelectorAll('input');
        membersData[index].name = inputs[0].value;
        membersData[index].lastMonth = Number(inputs[1].value) || 0;
        membersData[index].thisMonth = Number(inputs[2].value) || 0;
        membersData[index].total = Number(inputs[3].value) || 0;
        membersData[index].adjustment = Number(inputs[4].value) || 0;

        const total = membersData[index].total;
        const adj = membersData[index].adjustment;
        const calc = Math.floor((total * 0.008) + adj);
        
        totalReiseiAll += calc;
        totalSeiryokuPAll += total;
        document.getElementById(`reisei-${index}`).innerText = calc.toLocaleString() + ' 名声';
    });

    const totalSeiryokuPoolReisei = totalSeiryokuPAll * 0.008;
    const surplusReisei = totalSeiryokuPoolReisei - totalReiseiAll;
    const surplusElement = document.getElementById('surplus-reisei');
    if (surplusElement) {
        surplusElement.innerText = `${Math.floor(surplusReisei).toLocaleString()} 名声`;
    }
}

function updateCalculations() {
    gatherInputData();
    let totalThisMonthAll = 0;
    let totalSeiryokuPAll = 0;

    membersData.forEach(m => {
        totalThisMonthAll += Number(m.thisMonth) || 0;
        totalSeiryokuPAll += Number(m.total) || 0;
    });

    document.getElementById('total-seiryoku-p').innerText = totalSeiryokuPAll.toLocaleString() + ' P';
    document.getElementById('total-reisei').innerText = `基準名声換算: ${Math.floor(totalSeiryokuPAll * 0.008).toLocaleString()} 名声`;
    document.getElementById('total-this-month').innerText = totalThisMonthAll.toLocaleString() + ' P';
    document.getElementById('total-company-fee').innerText = `運営費プール(20%): ${Math.floor(totalThisMonthAll * 0.20).toLocaleString()} P`;
}

function saveData() {
    const inputPassword = prompt("管理者の認証パスワードを入力してください：");
    if (inputPassword === null) return;

    if (inputPassword !== ADMIN_PASSWORD) {
        alert("パスワードが違います。保存権限がありません。");
        return;
    }

    gatherInputData();
    localStorage.setItem('seiryoku_members_v7', JSON.stringify(membersData));
    localStorage.setItem('seiryoku_history_v5', JSON.stringify(historyRecord));
    localStorage.setItem('seiryoku_logs_v5', JSON.stringify(logsData));
    alert('パスワード認証成功：変更を保存しました！');
    renderTable();
}

function resetData() {
    const inputPassword = prompt("管理者パスワードを入力してください（初期化します）：");
    if (inputPassword === null) return;

    if (inputPassword !== ADMIN_PASSWORD) {
        alert("パスワードが違います。権限がありません。");
        return;
    }

    if (confirm('本当に初期データに戻しますか？')) {
        localStorage.removeItem('seiryoku_members_v7');
        localStorage.removeItem('seiryoku_history_v5');
        localStorage.removeItem('seiryoku_logs_v5');
        membersData = JSON.parse(JSON.stringify(members));
        historyRecord = JSON.parse(JSON.stringify(historyData));
        logsData = JSON.parse(JSON.stringify(eventLogs));
        renderTable();
        alert('初期データにリセットしました。');
    }
}

window.onload = function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateField = document.getElementById('log-date');
    if(dateField) dateField.value = `${yyyy}-${mm}-${dd}`;

    renderTable();
};
