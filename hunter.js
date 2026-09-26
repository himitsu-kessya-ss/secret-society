// hunter.js （総クレジット計算・数値パース強化版）
$(document).ready(function () {
    let globalMechDataList = [];
    let globalRouteData = [];

    // 早見表のHTMLを自動生成して埋め込む
    function initHayamiTable() {
        let tbodyHtml = '';
        if (typeof HUNTER_CONFIG !== 'undefined' && HUNTER_CONFIG.hayamiData) {
            HUNTER_CONFIG.hayamiData.forEach(item => {
                tbodyHtml += `<tr><td>${item.day}日</td><td>${item.addVal}</td><td>${item.range}</td></tr>`;
            });
            $('#hayami-data tbody').html(tbodyHtml);
        }
    }

    // 今日の情報をデータから取得
    function getTodayData() {
        const d = new Date().getDate();
        if (typeof HUNTER_CONFIG !== 'undefined' && HUNTER_CONFIG.hayamiData) {
            const target = HUNTER_CONFIG.hayamiData[d - 1] || HUNTER_CONFIG.hayamiData[0];
            return {
                day: target.day,
                addVal: target.addVal,
                range: target.range
            };
        }
        return { day: d, addVal: 111, range: "1 - 100" }; // フォールバック
    }

    // ① 計算機と＋1500戦スケジュールの即時反映
    $('#input-battle').on('input', function() {
        const prev = parseInt($(this).val());
        const data = getTodayData();
        const scheduleArea = $('#schedule-area');
        const tbody = document.querySelector('#schedule-table tbody');

        if (isNaN(prev)) { 
            $('#calc-res').text("数値を入力してください"); 
            scheduleArea.hide();
            return; 
        }
        
        const firstHc = Math.floor((prev / data.addVal) + 1) * data.addVal;
        $('#calc-res').html(`今日の最初のHCは <strong style="color:var(--accent-color);">${firstHc.toLocaleString()}</strong> 戦目です`);

        const startBattle = prev + 1;
        const maxBattle = prev + 1500;
        let events = {};

        let currentHc = firstHc;
        let hcCount = 1;
        while (currentHc <= maxBattle) {
            if (currentHc >= startBattle) {
                if (!events[currentHc]) events[currentHc] = { hc: '', scramble: '' };
                events[currentHc].hc = `${hcCount}回目`;
            }
            currentHc += data.addVal;
            hcCount++;
        }

        const scrambleInterval = 158;
        let sBattle = Math.floor(prev / scrambleInterval) * scrambleInterval + scrambleInterval;
        let scrambleCount = 1;

        while (sBattle <= maxBattle) {
            if (sBattle >= startBattle) {
                if (!events[sBattle]) events[sBattle] = { hc: '', scramble: '' };
                events[sBattle].scramble = `${scrambleCount}回目`;
            }
            sBattle += scrambleInterval;
            scrambleCount++;
        }

        const sortedBattles = Object.keys(events).map(Number).sort((a, b) => a - b);

        tbody.innerHTML = '';
        if (sortedBattles.length > 0) {
            scheduleArea.show();
            sortedBattles.forEach(battle => {
                const item = events[battle];
                const tr = document.createElement('tr');
                
                if (item.hc && item.scramble) {
                    tr.className = 'row-both';
                } else if (item.scramble) {
                    tr.className = 'row-scramble';
                } else {
                    tr.className = 'row-hc';
                }

                tr.innerHTML = `
                    <td><strong>${battle.toLocaleString()}戦</strong></td>
                    <td>${item.hc || 'ー'}</td>
                    <td>${item.scramble || 'ー'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            scheduleArea.hide();
        }
    });

    // ② 今日のデータ更新 & ③ ランキング解析のトリガー
    function refreshTodayTab() {
        const data = getTodayData();
        $('#today-info').html(`本日は ${data.day}日： 加算値 <b style="color:var(--accent-color);">${data.addVal}</b> / 出現No <b style="color:var(--accent-color);">${data.range}</b>`);
        
        const [min, max] = data.range.split(' - ').map(s => parseInt(s.trim()));
        loadAndRankUnitsWithRoute(min, max);
    }

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

    // 🌟 頑丈になった累積コスト算出関数（数値パースを完全強化）
    function calculateCumulativeCost(targetMechName) {
        let targetRow = null;
        for (let i = 0; i < globalRouteData.length; i++) {
            let row = globalRouteData[i];
            if (row[2] && row[2] === targetMechName) {
                targetRow = row;
                break;
            }
        }
        if (!targetRow) {
            for (let i = 0; i < globalRouteData.length; i++) {
                let row = globalRouteData[i];
                if (row.some((col, colIndex) => colIndex >= 3 && col === targetMechName)) {
                    targetRow = row;
                    break;
                }
            }
        }

        // 補助関数：安全に数値に変換する
        function parseNum(val) {
            if (val === undefined || val === null || val === "" || val === "-") return 0;
            let num = parseInt(String(val).replace(/,/g, ''), 10);
            return isNaN(num) ? 0 : num;
        }

        if (!targetRow) {
            let mechInfo = globalMechDataList.find(row => row.some(col => col === targetMechName));
            if (mechInfo) {
                let fame = parseNum(mechInfo[14]);
                let credit = parseNum(mechInfo[18]);
                return { totalFame: fame, totalCredit: credit };
            }
            return { totalFame: 0, totalCredit: 0 };
        }

        let routeNames = [];
        for (let i = 3; i < targetRow.length; i++) {
            let val = targetRow[i];
            if (val && val !== "0" && val !== "-" && val !== "") {
                let existsInMech = globalMechDataList.some(mechRow => mechRow.includes(val));
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
            let mechInfo = globalMechDataList.find(row => row.some(col => col === mechName));
            if (mechInfo) {
                let fame = parseNum(mechInfo[14]);
                let credit = parseNum(mechInfo[18]); // クレジット（インデックス18）
                sumFame += fame;
                sumCredit += credit;
            }
        });

        return { totalFame: sumFame, totalCredit: sumCredit };
    }

    // ③ 機体一覧と派生ルートCSVを読み込んでランキング算出
    function loadAndRankUnitsWithRoute(min, max) {
        if (typeof HUNTER_CONFIG === 'undefined' || !HUNTER_CONFIG.csvFile) {
            $('#unit-error').text("設定ファイル(HUNTER_CONFIG)が見つかりません。").show();
            return;
        }

        const MECH_CSV = HUNTER_CONFIG.csvFile; 
        const routeCsvCandidates = [
            "route/GL)機体派生ルート_260924 - 派生ルート.csv",
            "./route/GL)機体派生ルート_260924 - 派生ルート.csv",
            "../route/GL)機体派生ルート_260924 - 派生ルート.csv"
        ];

        if (globalMechDataList.length > 0 && globalRouteData.length > 0) {
            processRanking(min, max);
            return;
        }

        fetch(MECH_CSV)
            .then(res => res.text())
            .then(mechCsvText => {
                globalMechDataList = parseCSV(mechCsvText);
                tryFetchRouteCSV(routeCsvCandidates, 0, () => {
                    processRanking(min, max);
                });
            })
            .catch(err => {
                $('#unit-error').text("機体一覧CSVの読み込みに失敗しました: " + err.message).show();
            });
    }

    function tryFetchRouteCSV(candidates, index, callback) {
        if (index >= candidates.length) {
            globalRouteData = []; 
            callback();
            return;
        }

        fetch(candidates[index])
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.text();
            })
            .then(routeCsvText => {
                globalRouteData = parseCSV(routeCsvText);
                callback();
            })
            .catch(() => {
                tryFetchRouteCSV(candidates, index + 1, callback);
            });
    }

    function processRanking(min, max) {
        const filtered = globalMechDataList.filter(row => {
            let no = parseInt(row[0]);
            return !isNaN(no) && no >= min && no <= max;
        });

        if (filtered.length === 0) {
            $('#unit-error').text(`範囲内の機体が見つかりません(No ${min}-${max})`).show();
            $('#rank-fame').html("データなし");
            $('#rank-point').html("データなし");
            return;
        }
        $('#unit-error').hide();

        let processedUnits = filtered.map(row => {
            let no = row[0];
            let name = row[1] || ("No." + no);
            let costs = calculateCumulativeCost(name);
            return {
                no: no,
                name: name,
                totalFame: costs.totalFame,
                totalCredit: costs.totalCredit
            };
        });

        // 総名声ランキング ベスト3 (降順)
        displayCustomRank(processedUnits, 'totalFame', '#rank-fame', '総名声', '#00d4ff');
        // 総クレジットランキング ベスト3 (降順)
        displayCustomRank(processedUnits, 'totalCredit', '#rank-point', '総クレジット', '#ffeb3b');
    }

    function displayCustomRank(dataArray, sortKey, targetId, labelName, valColor) {
        // 降順ソート
        const sorted = [...dataArray].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 3);

        let html = '';
        sorted.forEach((u, i) => {
            let valStr = u[sortKey].toLocaleString();
            html += `<div class="unit-card">
                <span class="rank-badge">${i+1}</span><strong>${u.name}</strong>
                <span class="unit-val" style="color:${valColor};">${labelName}: ${valStr}</span>
           </div>`;
        });
        $(targetId).html(html);
    }

    // タブ切り替え処理
    $('.tab-btn').on('click', function() {
        $('.tab-btn').removeClass('active');$(this).addClass('active');
        const type = $(this).data('type');

        $('#today-tool, #text-content-display, #content-frame, #static-table-area').hide();

        if (type === 'today') {
            $('#today-tool').show();
            refreshTodayTab();
        } else if (type === 'txt') {
            $('#text-content-display').show().text("読み込み中...");
            fetch($(this).data('file')).then(r => r.arrayBuffer()).then(buf => {
                let txt = new TextDecoder('utf-8').decode(buf);
                if (txt.includes('\uFFFD')) txt = new TextDecoder('shift-jis').decode(buf);
                $('#text-content-display').html(txt);
            });
        } else if (type === 'html') {
            $('#content-frame').attr('src', $(this).data('file')).show();
        } else if (type === 'static') {
            $('#static-table-area').show();
        }
    });

    // 初期化実行
    initHayamiTable();
    refreshTodayTab();
});
