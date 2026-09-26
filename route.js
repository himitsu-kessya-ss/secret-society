<!-- route.js -->

const MECH_CSV = "route/GL)機体一覧 - 機体一覧.csv";
const ROUTE_CSV = "route/GL)機体派生ルート_260924 - 派生ルート.csv";

let mechDataList = []; 
let routeData = [];    

window.onload = function() {
    Promise.all([
        fetch(MECH_CSV).then(res => res.text()),
        fetch(ROUTE_CSV).then(res => res.text())
    ])
    .then(([mechCsv, routeCsv]) => {
        mechDataList = parseCSV(mechCsv);
        routeData = parseCSV(routeCsv);

        let validRouteRows = routeData.filter(row => row.length > 2 && row[2] !== "" && row[2] !== "目的派生検索");

        document.getElementById("logBox").innerHTML = 
            `【動作確認ログ】<br><span style="color:#69f0ae;">読み込み成功！</span> 機体一覧: ${mechDataList.length}件 / 派生ルート: ${validRouteRows.length}件`;
    })
    .catch(error => {
        document.getElementById("logBox").innerHTML = 
            `【動作確認ログ】<br><span style="color:#ff6b6b;">読み込みエラー: ${error.message}</span>`;
    });
};

// CSVパーサー（ダブルクォーテーション対応）
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

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        searchRoute();
    }
}

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

    // 1. 機体No.の枠に入力がある場合優先してNo.（列index: 1）で検索
    if (noKeyword) {
        for (let i = 0; i < routeData.length; i++) {
            let row = routeData[i];
            if (row[1] && row[1] === noKeyword) {
                targetRow = row;
                break;
            }
        }
    }

    // 2. 機体名の枠に入力がある場合、またはNo.で見つからなかった場合、機体名（目的派生検索 列index: 2）で検索
    if (!targetRow && nameKeyword) {
        for (let i = 0; i < routeData.length; i++) {
            let row = routeData[i];
            if (row[2] && row[2] === nameKeyword) {
                targetRow = row;
                break;
            }
        }
    }

    // 3. それでも見つからない場合、ルート内のどこかに機体名が含まれていないか柔軟に探す
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
        document.getElementById("tableBody").innerHTML = `<tr><td colspan="24" style="padding: 20px; color: #ff6b6b;">指定された条件に一致する派生ルートが見つかりませんでした。</td></tr>`;
        document.getElementById("totalCredit").innerText = "0";
        document.getElementById("totalFame").innerText = "0";
        return;
    }

    // 3列目以降（index 3以降）のルートを抽出
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
        document.getElementById("tableBody").innerHTML = `<tr><td colspan="24" style="padding: 20px; color: #ff6b6b;">有効な派生ルートデータが見つかりませんでした。</td></tr>`;
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
                </tr>
            `;
        } else {
            tableHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td class="name-col">${mechName}</td>
                    <td colspan="22" style="color: #ff6b6b;">「機体一覧」CSVに詳細データが見つかりません</td>
                </tr>
            `;
        }
    });

    document.getElementById("tableBody").innerHTML = tableHtml;
    document.getElementById("totalCredit").innerText = totalCredit.toLocaleString();
    document.getElementById("totalFame").innerText = totalFame.toLocaleString();
}
