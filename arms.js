// CSV/TXT 読み込み処理
async function loadData() {
    try {
        const resW = await fetch('武器一覧.csv');
        const txtW = await resW.text();
        renderTable('weapon', txtW);

        const resE = await fetch('装備一覧.csv');
        const txtE = await resE.text();
        renderTable('equip', txtE);

        const resS = await fetch('武器庫.txt');
        const txtS = await resS.text();
        document.getElementById('system-content').innerText = txtS;

        updateSearchOptions();
    } catch (e) {
        document.getElementById('system-content').innerText = "エラー：GitHubにアップロードして確認してください。";
    }
}

function renderTable(type, csvData) {
    const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== '');
    if (rows.length === 0) return;
    
    const headers = rows[0].split(',');
    document.getElementById(`${type}-head`).innerHTML = headers.map(h => `<th>${h}</th>`).join('');
    
    const body = rows.slice(1).map(row => {
        const cols = row.split(',');
        return `<tr>${cols.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('');
    document.getElementById(`${type}-body`).innerHTML = body;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabName).style.display = 'block';
    event.currentTarget.classList.add('active');
    document.getElementById('search-wrapper').style.visibility = (tabName === 'system') ? 'hidden' : 'visible';
    updateSearchOptions();
    document.getElementById('search-box').value = '';
    filterData();
}

function updateSearchOptions() {
    const activeTab = document.querySelector('.tab-content[style*="block"], .tab-content:not([style*="none"])');
    if (!activeTab) return;
    const headers = activeTab.querySelectorAll('th');
    const select = document.getElementById('search-column');
    let options = '<option value="all">すべての項目</option>';
    headers.forEach((th, index) => {
        options += `<option value="${index}">${th.innerText}</option>`;
    });
    select.innerHTML = options;
}

function filterData() {
    const input = document.getElementById('search-box').value.toUpperCase();
    const colIndex = document.getElementById('search-column').value;
    const activeTab = document.querySelector('.tab-content[style*="block"], .tab-content:not([style*="none"])');
    const rows = activeTab.querySelectorAll('tbody tr');

    rows.forEach(row => {
        let match = false;
        const cells = row.getElementsByTagName('td');
        if (colIndex === "all") {
            match = row.innerText.toUpperCase().indexOf(input) > -1;
        } else {
            const targetCell = cells[colIndex];
            if (targetCell && targetCell.innerText.toUpperCase().indexOf(input) > -1) match = true;
        }
        row.style.display = match ? "" : "none";
    });
}

// ページ読み込み時にデータを取得開始
loadData();
