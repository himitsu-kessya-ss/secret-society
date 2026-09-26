const MECH_CSV = "route/GL)機体一覧 - 機体一覧.csv";
const ROUTE_CSV = "route/GL)機体派生ルート_260924 - 派生ルート.csv";

let mechDataList = []; 
let routeData = [];    
let filteredMechList = []; 
let currentPage = 1;
const itemsPerPage = 100; 

// 1. 共通ヘッダー読み込み ＆ タブ切り替えの設定
document.addEventListener('DOMContentLoaded', () => {
    // 共通ヘッダーの取得
    fetch('header.html')
        .then(response => response.text())
        .then(data => {
            const headerContainer = document.getElementById('header-container');
            if (headerContainer) {
                headerContainer.innerHTML = data;
                
                const currentPath = window.location.pathname.split('/').pop() || 'route.html';
                const navLinks = document.querySelectorAll('.nav-links a');
                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href === currentPath) {
                        link.classList.add('active');
                    }
                });
            }
        })
        .catch(error => {
            console.error('ヘッダーの読み込みに失敗しました:', error);
        });

    // タブ切り替え処理
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // イベントリスナーの結びつけ
    const calcBtn = document.getElementById("calc-btn");
    if (calcBtn) calcBtn.addEventListener("click", searchRoute);

    const searchName = document.getElementById("searchName");
    if (searchName) {
        searchName.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') searchRoute();
        });
    }

    const searchNo = document.getElementById("searchNo");
    if (searchNo) {
        searchNo.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') searchRoute();
        });
    }

    const tableSearchInput = document.getElementById("tableSearchInput");
    if (tableSearchInput) {
        tableSearchInput.addEventListener("input", filterMechTable);
    }

    const prevBtn = document.getElementById("prevBtn");
    if (prevBtn) prevBtn.addEventListener("click", prevPage);

    const nextBtn = document.getElementById("nextBtn");
    if (nextBtn) nextBtn.addEventListener("click", nextPage);

    // データの読み込み開始
    loadCSVData();
});

// 2. CSVデータの非同期取得
function loadCSVData() {
    Promise.all([
        fetch(MECH_CSV).then(res => res.text()),
        fetch(ROUTE_CSV).then(res => res.text())
    ])
    .then(([mechCsv, routeCsv]) => {
        mechDataList = parseCSV(mechCsv);
        routeData = parseCSV(routeCsv);

        let validRouteRows = routeData.filter(row => row.length > 2 && row[2] !== "" && row[2] !== "目的派生検索");

        const logBox = document.getElementById("logBox");
        if (logBox) {
            logBox.innerHTML = 
                `【動作確認ログ】<br>` +
                `<span style="color:#69f0ae;">✔ 読み込み成功！</span><br>` +
                `・機体一覧データ: <strong>${mechDataList.length}</strong> 件<br>` +
                `・有効な派生ルート: <strong>${validRouteRows.length}</strong> 件`;
        }

        filteredMechList = mechDataList;
        renderMechTable();
    })
    .catch(error => {
        const logBox = document.getElementById("logBox");
        if (logBox) {
            logBox.innerHTML = `【動作確認ログ】<br><span style="color:#ff6b6b;">読み込みエラー: ${error.message}</span>`;
        }
    });
}

// 3. CSVパーサー（ダブルクォーテーション対応）
function parseCSV(text) {
    let rows = [];
    let currentRow = [];
    let currentVal = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        let nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentVal += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentVal.trim());
            currentVal = "";
        } else if ((char === '\r' && nextChar === '\n') && !inQuotes) {
            currentRow.push(currentVal.trim());
            rows.push(currentRow);
            currentRow = [];
            currentVal = "";
            i++;
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentVal.trim());
            rows.push(currentRow);
            currentRow = [];
            currentVal = "";
        } else {
            currentVal += char;
        }
    }
    if (currentVal !== "" || currentRow.length > 0) {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
    }

    return rows.filter(row => row.length > 0 && row.some(val => val !== ""));
}

// 4. 累積コスト計算関数
function calculateCumulativeCost(targetMechName) {
    let targetRow = null;
    for (let i = 0; i < routeData.length; i++) {
        let row = routeData[i];
        if (row[2] && row[2] === targetMechName) {
            targetRow = row;
            break;
        }
    }
    if (!targetRow) {
        for (let i = 0; i < routeData.length; i++) {
            let row = routeData[i];
            if (row.some((col, colIndex) => colIndex >= 3 && col === targetMechName)) {
                targetRow = row;
                break;
            }
        }
    }

    if (!targetRow) {
        let mechInfo = mechDataList.find(row => row.some(col => col === targetMechName));
        if (mechInfo) {
            let fame = parseInt(String(mechInfo[14]).replace(/,/g, '')) || 0;
            let credit = parseInt(String(mechInfo[18]).replace(/,/g, '')) || 0;
            return { totalFame: fame, totalCredit: credit };
        }
        return { totalFame: 0, totalCredit: 0 };
    }

    let routeNames = [];
    for (let i = 3; i < targetRow.length; i++) {
        let val = targetRow[i];
        if (val && val !== "0" && val !== "-" && val !== "") {
            let existsInMech = mechDataList.some(mechRow => mechRow.includes(val));
            if (existsInMech) {
                if (!routeNames.includes(val)) {
                    routeNames.push(val);
                }
            }
        }
    }

    let sumFame = 0;
    let sumCredit = 0;

    routeNames.forEach(mechName => {
        let mechInfo = mechDataList.find(row => row.some(col => col === mechName));
        if (mechInfo) {
            let fame = parseInt(String(mechInfo[14]).replace(/,/g, '')) || 0;
            let credit = parseInt(String(mechInfo[18]).replace(/,/g, '')) || 0;
            sumFame += fame;
            sumCredit += credit;
        }
    });

    return { totalFame: sumFame, totalCredit: sumCredit };
}

// 5. 機体一覧テーブルのレンダリング（ページネーション対応）
function renderMechTable() {
    const tbody = document.getElementById("fullTableBody");
    const countDisplay = document.getElementById("mechCountDisplay");
    const paginationBox = document.getElementById("paginationBox");

    if (!tbody) return;

    countDisplay.innerText = `全 ${filteredMechList.length} 件`;

    if (filteredMechList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="26" style="padding: 20px; color: #ff6b6b;">一致する機体が見つかりませんでした。</td></tr>`;
        if (paginationBox) paginationBox.style.display = "none";
        return;
    }

    const totalPages = Math.ceil(filteredMechList.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageData = filteredMechList.slice(startIdx, endIdx);

    let tableHtml = "";
    pageData.forEach((mechRow, idx) => {
        let no = mechRow[0] !== undefined ? mechRow[0] : (startIdx + idx + 1);
        let mechName = mechRow[1] !== undefined ? mechRow[1] : "-";
        let transform = mechRow[2] !== undefined ? mechRow[2] : "-";
        let hp = mechRow[3] !== undefined ? mechRow[3] : "-";
        let armor = mechRow[4] !== undefined ? mechRow[4] : "-";
        let mobility = mechRow[5] !== undefined ? mechRow[5] : "-";
        let search = mechRow[6] !== undefined ? mechRow[6] : "-";
        let en = mechRow[7] !== undefined ? mechRow[7] : "-";
        let weight = mechRow[8] !== undefined ? mechRow[8] : "-";
        let intuition = mechRow[9] !== undefined ? mechRow[9] : "-";
        let control = mechRow[10] !== undefined ? mechRow[10] : "-";
        let closeAtk = mechRow[11] !== undefined ? mechRow[11] : "-";
        let midAtk = mechRow[12] !== undefined ? mechRow[12] : "-";
        let longAtk = mechRow[13] !== undefined ? mechRow[13] : "-";
        let fame = mechRow[14] !== undefined ? mechRow[14] : "0";
        let nt = mechRow[15] !== undefined ? mechRow[15] : "-";
        let size = mechRow[16] !== undefined ? mechRow[16] : "-";
        let cost = mechRow[17] !== undefined ? mechRow[17] : "0";
        let credit = mechRow[18] !== undefined ? mechRow[18] : "0";
        let land = mechRow[19] !== undefined ? mechRow[19] : "-";
        let water = mechRow[20] !== undefined ? mechRow[20] : "-";
        let space = mechRow[21] !== undefined ? mechRow[21] : "-";
        let air = mechRow[22] !== undefined ? mechRow[22] : "-";
        let type = mechRow[23] !== undefined ? mechRow[23] : "-";

        let costCalc = calculateCumulativeCost(mechName);

        tableHtml += `
            <tr>
                <td>${no}</td>
                <td class="name-col">${mechName}</td>
                <td>${transform}</td>
                <td>${hp}</td>
                <td>${armor}</td>
                <td>${mobility}</td>
                <td>${search}</td>
                <td>${en}</td>
                <td>${weight}</td>
                <td>${intuition}</td>
                <td>${control}</td>
                <td>${closeAtk}</td>
                <td>${midAtk}</td>
                <td>${longAtk}</td>
                <td>${fame}</td>
                <td>${nt}</td>
                <td>${size}</td>
                <td>${cost}</td>
                <td>${credit}</td>
                <td>${land}</td>
                <td>${water}</td>
                <td>${space}</td>
                <td>${air}</td>
                <td class="name-col">${type}</td>
                <td class="cost-col">${costCalc.totalFame.toLocaleString()}</td>
                <td class="cost-col">${costCalc.totalCredit.toLocaleString()}</td>
            </tr>
        `;
    });

    tbody.innerHTML = tableHtml;

    if (paginationBox && totalPages > 1) {
        paginationBox.style.display = "flex";
        document.getElementById("pageInfo").innerText = `${currentPage} / ${totalPages} ページ (全 ${filteredMechList.length}件)`;
        document.getElementById("prevBtn").disabled = (currentPage === 1);
        document.getElementById("nextBtn").disabled = (currentPage === totalPages);
    } else if (paginationBox) {
        paginationBox.style.display = "none";
    }
}

function filterMechTable() {
    const keyword = document.getElementById("tableSearchInput").value.trim().toLowerCase();
    if (!keyword) {
        filteredMechList = mechDataList;
    } else {
        filteredMechList = mechDataList.filter(row => {
            let noStr = String(row[0] || "").toLowerCase();
            let nameStr = String(row[1] || "").toLowerCase();
            let typeStr = String(row[23] || "").toLowerCase();
            return noStr.includes(keyword) || nameStr.includes(keyword) || typeStr.includes(keyword);
        });
    }
    currentPage = 1;
    renderMechTable();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderMechTable();
        const container = document.getElementById("fullMechTable")?.parentElement;
        if (container) container.scrollTop = 0;
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredMechList.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderMechTable();
        const container = document.getElementById("fullMechTable")?.parentElement;
        if (container) container.scrollTop = 0;
    }
}

// 6. 派生ルート検索処理
function searchRoute() {
    if (mechDataList.length === 0 || routeData.length === 0) {
        alert("まだデータの読み込みが完了していません。");
        return;
    }

    const nameKeyword = document.getElementById("searchName").value.trim();
    const noKeyword = document.getElementById("searchNo").value.trim();

    if (!nameKeyword && !noKeyword) {
        alert("「機体名」または「機体No.」のどちらかを入力してください。");
        return;
    }

    let targetRow = null;

    if (noKeyword) {
        for (let i = 0; i < routeData.length; i++) {
            let row = routeData[i];
            if (row[1] && row[1] === noKeyword) {
                targetRow = row;
                break;
            }
        }
    }

    if (!targetRow && nameKeyword) {
        for (let i = 0; i < routeData.length; i++) {
            let row = routeData[i];
            if (row[2] && row[2] === nameKeyword) {
                targetRow = row;
                break;
            }
        }
    }

    if (!targetRow && nameKeyword) {
        for (let i = 0; i < routeData.length; i++) {
            let row = routeData[i];
            if (row.some((col, colIndex) => colIndex >= 3 && col === nameKeyword)) {
                targetRow = row;
                break;
            }
        }
    }

    if (!targetRow) {
        document.getElementById("routeDisplay").innerText = "派生ルート：見つかりませんでした";
        document.getElementById("tableBody").innerHTML = `<tr><td colspan="26" style="padding: 20px; color: #ff6b6b;">指定された条件に一致する派生ルートが見つかりませんでした。</td></tr>`;
        document.getElementById("totalCredit").innerText = "0";
        document.getElementById("totalFame").innerText = "0";
        return;
    }

    let routeNames = [];
    for (let i = 3; i < targetRow.length; i++) {
        let val = targetRow[i];
        if (val && val !== "0" && val !== "-" && val !== "") {
            let existsInMech = mechDataList.some(mechRow => mechRow.includes(val));
            if (existsInMech) {
                if (!routeNames.includes(val)) {
                    routeNames.push(val);
                }
            }
        }
    }

    if (routeNames.length === 0) {
        document.getElementById("routeDisplay").innerText = "派生ルート：有効なルートが見つかりませんでした";
        document.getElementById("tableBody").innerHTML = `<tr><td colspan="26" style="padding: 20px; color: #ff6b6b;">有効な派生ルートデータが見つかりませんでした。</td></tr>`;
        document.getElementById("totalCredit").innerText = "0";
        document.getElementById("totalFame").innerText = "0";
        return;
    }

    document.getElementById("routeDisplay").innerText = "派生ルート：" + routeNames.join(" ⇒ ");

    let tableHtml = "";
    let totalCredit = 0;
    let totalFame = 0;

    routeNames.forEach((mechName, index) => {
        let mechInfo = mechDataList.find(row => {
            return row.some(col => col === mechName);
        });

        if (mechInfo) {
            let transform = mechInfo[2] !== undefined ? mechInfo[2] : "-";
            let hp = mechInfo[3] !== undefined ? mechInfo[3] : "-";
            let armor = mechInfo[4] !== undefined ? mechInfo[4] : "-";
            let mobility = mechInfo[5] !== undefined ? mechInfo[5] : "-";
            let search = mechInfo[6] !== undefined ? mechInfo[6] : "-";
            let en = mechInfo[7] !== undefined ? mechInfo[7] : "-";
            let weight = mechInfo[8] !== undefined ? mechInfo[8] : "-";
            let intuition = mechInfo[9] !== undefined ? mechInfo[9] : "-";
            let control = mechInfo[10] !== undefined ? mechInfo[10] : "-";
            let closeAtk = mechInfo[11] !== undefined ? mechInfo[11] : "-";
            let midAtk = mechInfo[12] !== undefined ? mechInfo[12] : "-";
            let longAtk = mechInfo[13] !== undefined ? mechInfo[13] : "-";
            let fame = mechInfo[14] !== undefined ? mechInfo[14] : "0";
            let nt = mechInfo[15] !== undefined ? mechInfo[15] : "-";
            let size = mechInfo[16] !== undefined ? mechInfo[16] : "-";
            let cost = mechInfo[17] !== undefined ? mechInfo[17] : "0";
            let credit = mechInfo[18] !== undefined ? mechInfo[18] : "0";
            let land = mechInfo[19] !== undefined ? mechInfo[19] : "-";
            let water = mechInfo[20] !== undefined ? mechInfo[20] : "-";
            let space = mechInfo[21] !== undefined ? mechInfo[21] : "-";
            let air = mechInfo[22] !== undefined ? mechInfo[22] : "-";
            let type = mechInfo[23] !== undefined ? mechInfo[23] : "-";

            let creditNum = parseInt(String(credit).replace(/,/g, '')) || 0;
            let fameNum = parseInt(String(fame).replace(/,/g, '')) || 0;
            totalCredit += creditNum;
            totalFame += fameNum;

            let costCalc = calculateCumulativeCost(mechName);

            tableHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="name-col">${mechName}</td>
                    <td>${transform}</td>
                    <td>${hp}</td>
                    <td>${armor}</td>
                    <td>${mobility}</td>
                    <td>${search}</td>
                    <td>${en}</td>
                    <td>${weight}</td>
                    <td>${intuition}</td>
                    <td>${control}</td>
                    <td>${closeAtk}</td>
                    <td>${midAtk}</td>
                    <td>${longAtk}</td>
                    <td>${fame}</td>
                    <td>${nt}</td>
                    <td>${size}</td>
                    <td>${cost}</td>
                    <td>${credit}</td>
                    <td>${land}</td>
                    <td>${water}</td>
                    <td>${space}</td>
                    <td>${air}</td>
                    <td class="name-col">${type}</td>
                    <td class="cost-col">${costCalc.totalFame.toLocaleString()}</td>
                    <td class="cost-col">${costCalc.totalCredit.toLocaleString()}</td>
                </tr>
            `;
        } else {
            tableHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="name-col">${mechName}</td>
                    <td colspan="25" style="color: #ff6b6b;">「機体一覧」CSVに詳細データが見つかりません</td>
                </tr>
            `;
        }
    });

    const tableBody = document.getElementById("tableBody");
    if (tableBody) tableBody.innerHTML = tableHtml;

    const totalCreditEl = document.getElementById("totalCredit");
    if (totalCreditEl) totalCreditEl.innerText = totalCredit.toLocaleString();

    const totalFameEl = document.getElementById("totalFame");
    if (totalFameEl) totalFameEl.innerText = totalFame.toLocaleString();
}
