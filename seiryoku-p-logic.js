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

let members = loadData('seiryoku_members_v4', initialMembers);
let historyData = loadData('seiryoku_history_v2', initialHistory);

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

    members.forEach((m, index) => {
        const thisMonth = Number(m.thisMonth) || 0;
        const total = Number(m.total) || 0;
        const adjustment = Number(m.adjustment) || 0;

        // 勢力Pから名声への換算は 0.008倍
        const calculatedReisei = Math.floor((total * 0.008) + adjustment);

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
            <td style="color: #00d4ff; font-weight: bold; text-align: center;" id="reisei-${index}">${calculatedReisei.toLocaleString()} 名声</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('total-seiryoku-p').innerText = totalSeiryokuPAll.toLocaleString() + ' P';
    document.getElementById('total-reisei').innerText = `基準名声換算: ${Math.floor(totalSeiryokuPAll * 0.008).toLocaleString()} 名声`;
    document.getElementById('total-this-month').innerText = totalThisMonthAll.toLocaleString() + ' P';
    document.getElementById('total-company-fee').innerText = `運営費プール(20%): ${Math.floor(totalThisMonthAll * 0.20).toLocaleString()} P`;

    renderHistoryTables();
}

function renderHistoryTables() {
    const totalThead = document.getElementById('history-total-thead');
    const totalTbody = document.getElementById('history-total-tbody');
    
    const monthlyThead = document.getElementById('history-monthly-thead');
    const monthlyTbody = document.getElementById('history-monthly-tbody');
    
    const rateThead = document.getElementById('history-rate-thead');
    const rateTbody = document.getElementById('history-rate-tbody');

    const memberHeadersHtml = members.map(m => `<th>${m.name}</th>`).join('');

    totalThead.innerHTML = `<tr><th>年</th><th>確認日</th><th>全合計</th>${memberHeadersHtml}</tr>`;
    monthlyThead.innerHTML = `<tr><th>年</th><th>確認日</th><th>当月獲得値</th>${memberHeadersHtml}</tr>`;
    rateThead.innerHTML = `<tr><th>年</th><th>確認日</th><th>列 1</th>${memberHeadersHtml}</tr>`;

    totalTbody.innerHTML = '';
    monthlyTbody.innerHTML = '';
    rateTbody.innerHTML = '';

    historyData.forEach(h => {
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

function gatherInputData() {
    const rows = document.querySelectorAll('#member-tbody tr');
    rows.forEach((row, index) => {
        const inputs = row.querySelectorAll('input');
        members[index].name = inputs[0].value;
        members[index].lastMonth = Number(inputs[1].value) || 0;
        members[index].thisMonth = Number(inputs[2].value) || 0;
        members[index].total = Number(inputs[3].value) || 0;
        members[index].adjustment = Number(inputs[4].value) || 0;

        const total = members[index].total;
        const adj = members[index].adjustment;
        const calc = Math.floor((total * 0.008) + adj);
        document.getElementById(`reisei-${index}`).innerText = calc.toLocaleString() + ' 名声';
    });
}

function updateCalculations() {
    gatherInputData();
    let totalThisMonthAll = 0;
    let totalSeiryokuPAll = 0;

    members.forEach(m => {
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
    localStorage.setItem('seiryoku_members_v4', JSON.stringify(members));
    localStorage.setItem('seiryoku_history_v2', JSON.stringify(historyData));
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
        localStorage.removeItem('seiryoku_members_v4');
        localStorage.removeItem('seiryoku_history_v2');
        members = [...initialMembers];
        historyData = [...initialHistory];
        renderTable();
        alert('初期データにリセットしました。');
    }
}

window.onload = renderTable;
