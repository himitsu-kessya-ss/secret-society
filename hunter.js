// hunter.js （完全版：スクランブル自動抽出 ＆ 当日スケジュール統合 ＆ 明日列別カラー対応）
$(document).ready(function () {
    let globalMechDataList = [];
    let globalRouteData = [];
    let scrambleBattles = new Set(); // スクランブルの戦闘回数を格納するセット

    // 特殊戦闘ファイルからスクランブルの回数を自動で抽出する関数
    function loadScrambleData() {
        return $.ajax({
            url: "特殊戦闘（HCやスクランブルなど）.txt",
            dataType: "arraybuffer"
        }).then(buf => {
            let txt = new TextDecoder('utf-8').decode(buf);
            if (txt.includes('\uFFFD')) {
                txt = new TextDecoder('shift-jis').decode(buf);
            }
            
            scrambleBattles.clear();
            // テキスト内から「数字＋戦」または「数字」のパターンを走査してスクランブル回数を抽出
            const lines = txt.split('\n');
            lines.forEach(line => {
                // 例: 「45588戦」や「45,588戦」のような記述をマッチさせる
                const matches = line.match(/([\d,]+)\s*戦/g);
                if (matches) {
                    matches.forEach(m => {
                        let num = parseInt(m.replace(/[,戦\s]/g, ''), 10);
                        if (!isNaN(num) && num > 0) {
                            scrambleBattles.add(num);
                        }
                    });
                }
            });
        }).catch(err => {
            console.log("スクランブルファイルの読み込みスキップ または エラー:", err);
        });
    }

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
        return { day: d, addVal: 111, range: "1 - 100" };
    }

    // 明日の情報をデータから取得（月末の場合は1日にループ）
    function getTomorrowData() {
        const now = new Date();
        const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const d = tomorrowDate.getDate();

        if (typeof HUNTER_CONFIG !== 'undefined' && HUNTER_CONFIG.hayamiData) {
            const target = HUNTER_CONFIG.hayamiData[d - 1] || HUNTER_CONFIG.hayamiData[0];
            return {
                day: target.day,
                addVal: target.addVal,
                range: target.range
            };
        }
        return { day: d, addVal: 111, range: "1 - 100" };
    }

    // ① 計算機と＋1500戦スケジュール（当日スケジュールにスクランブルを統合）の即時反映
    function updateSchedules() {
        const prev = parseInt($('#input-battle').val());
        const data = getTodayData();
        const tomorrowData = getTomorrowData();

        const scheduleArea = $('#schedule-area');
        const tbody = document.querySelector('#schedule-table tbody');
        
        const tomorrowScheduleArea = $('#tomorrow-schedule-area');
        const tomorrowTbody = document.querySelector('#tomorrow-schedule-table tbody');

        if (isNaN(prev)) { 
            $('#calc-res').text("数値を入力してください"); 
            scheduleArea.hide();
            tomorrowScheduleArea.hide();
            return; 
        }
        
        const startBattle = prev + 1;
        const maxBattle = prev + 1500;

        // サブテキストおよびテーブル見出しに実際の周期数値を反映
        $('#today-subtext').text(`※本日の加算値（周期: ${data.addVal}）をベースにHCおよびスクランブル出現タイミングを表示します。`);
        $('#tomorrow-subtext').text(`※同じ戦闘回数における「今日のHC（周期: ${data.addVal}）」と「明日のHC（周期: ${tomorrowData.addVal}）」のタイミングを比較できます。`);
        
        $('#th-today-label').text(`今日のHC（${data.addVal}）`);
        $('#th-tomorrow-label').text(`明日のHC（${tomorrowData.addVal}）`);

        // --- 当日のHCスケジュール ＆ スクランブル計算 ---
        const firstHc = Math.floor((prev / data.addVal) + 1) * data.addVal;
        $('#calc-res').html(`今日の最初のHCは <strong style="color:var(--accent-color);">${firstHc.toLocaleString()}</strong> 戦目です`);

        let events = {};
        let currentHc = firstHc;
        let hcCount = 1;
        while (currentHc <= maxBattle) {
            if (currentHc >= startBattle) {
                if (!events[currentHc]) events[currentHc] = [];
                events[currentHc].push(`${hcCount}回目`);
            }
            currentHc += data.addVal;
            hcCount++;
        }

        // スクランブル発生タイミングも当日の表に統合
        scrambleBattles.forEach(battleNum => {
            if (battleNum >= startBattle && battleNum <= maxBattle) {
                if (!events[battleNum]) events[battleNum] = [];
                events[battleNum].push("スクランブル");
            }
        });

        const sortedBattles = Object.keys(events).map(Number).sort((a, b) => a - b);

        tbody.innerHTML = '';
        if (sortedBattles.length > 0) {
            scheduleArea.show();
            sortedBattles.forEach(battle => {
                const infoList = events[battle];
                const tr = document.createElement('tr');
                
                // スクランブルが含まれている場合は専用の強調クラスを付与
                let isScrambleRow = infoList.some(item => item.includes("スクランブル"));
                tr.className = isScrambleRow ? 'col-scramble' : 'row-hc';

                tr.innerHTML = `
                    <td><strong>${battle.toLocaleString()}戦</strong></td>
                    <td>${infoList.join(' ＆ ')}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            scheduleArea.hide();
        }

        // --- 明日のスケジュール表（当日HC ＆ 明日HC の2列比較用マップ作成） ---
        let combinedEvents = {};

        let tCurrentHc = Math.floor((prev / data.addVal) + 1) * data.addVal;
        let tHcCount = 1;
        while (tCurrentHc <= maxBattle) {
            if (tCurrentHc >= startBattle) {
                if (!combinedEvents[tCurrentHc]) combinedEvents[tCurrentHc] = { todayHc: '', tomorrowHc: '' };
                combinedEvents[tCurrentHc].todayHc = `${tHcCount}回目`;
            }
            tCurrentHc += data.addVal;
            tHcCount++;
        }

        let tmCurrentHc = Math.floor((prev / tomorrowData.addVal) + 1) * tomorrowData.addVal;
        let tmHcCount = 1;
        while (tmCurrentHc <= maxBattle) {
            if (tmCurrentHc >= startBattle) {
                if (!combinedEvents[tmCurrentHc]) combinedEvents[tmCurrentHc] = { todayHc: '', tomorrowHc: '' };
                combinedEvents[tmCurrentHc].tomorrowHc = `${tmHcCount}回目`;
            }
            tmCurrentHc += tomorrowData.addVal;
            tmHcCount++;
        }

        const combinedSortedBattles = Object.keys(combinedEvents).map(Number).sort((a, b) => a - b);

        tomorrowTbody.innerHTML = '';
        if (combinedSortedBattles.length > 0) {
            tomorrowScheduleArea.show();
            combinedSortedBattles.forEach(battle => {
                const item = combinedEvents[battle];
                const tr = document.createElement('tr');
                tr.className = 'row-hc';

                tr.innerHTML = `
                    <td><strong>${battle.toLocaleString()}戦</strong></td>
                    <td>${item.todayHc || 'ー'}</td>
                    <td class="col-tomorrow">${item.tomorrowHc || 'ー'}</td>
                `;
                tomorrowTbody.appendChild(tr);
            });
        } else {
            tomorrowScheduleArea.hide();
        }
    }

    $('#input-battle').on('input', function() {
        updateSchedules();
    });

    // ② 今日のデータ更新 & ③ ランキング解析のトリガー
    function refreshTodayTab() {
        const data = getTodayData();
        $('#today-info').html(`本日は ${data.day}日： 加算値 <b style="color:var(--accent-color);">${data.addVal}</b> / 出現No <b style="color:var(--accent-color);">${data.range}</b>`);
        
        const [min, max] = data.range.split(' - ').map(s => parseInt(s.trim()));
        loadAndRankUnits(min, max);
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

    function parseNumber(val) {
        if (!val) return 0;
        let cleaned = String(val).replace(/["',]/g, '').trim();
        let num = parseInt(cleaned, 10);
        return isNaN(num) ? 0 : num;
    }

    function getMechColumnIndices() {
        return { 
            nameIdx: 1,      // 機体名
            fameIdx: 14,     // 名声（15番目）
            creditIdx: 18    // クレジット（19番目）
        };
    }

    function calculateCumulativeCost(targetMechName) {
        const { nameIdx, fameIdx, creditIdx } = getMechColumnIndices();
        
        let targetRow = null;
        for (let i = 0; i < globalRouteData.length; i++) {
            let row = globalRouteData[i];
            if (row && row.some(col => col === targetMechName)) {
                targetRow = row;
                break;
            }
        }

        if (!targetRow) {
            let mechInfo = globalMechDataList.find(row => row && row[nameIdx] === targetMechName);
            if (mechInfo) {
                return {
                    totalFame: parseNumber(mechInfo[fameIdx]),
                    totalCredit: parseNumber(mechInfo[creditIdx])
                };
            }
            return { totalFame: 0, totalCredit: 0 };
        }

        let sumFame = 0;
        let sumCredit = 0;
        let countedMechs = new Set();

        targetRow.forEach(val => {
            if (val && val !== "0" && val !== "-" && val !== "") {
                let mechInfo = globalMechDataList.find(row => row && row[nameIdx] === val);
                if (mechInfo && !countedMechs.has(val)) {
                    countedMechs.add(val);
                    sumFame += parseNumber(mechInfo[fameIdx]);
                    sumCredit += parseNumber(mechInfo[creditIdx]);
                }
            }
        });

        return { totalFame: sumFame, totalCredit: sumCredit };
    }

    function loadAndRankUnits(min, max) {
        const MECH_CSV = "route/GL)機体一覧 - 機体一覧.csv";
        const ROUTE_CSV = "route/GL)機体派生ルート_260924 - 派生ルート.csv";

        if (globalMechDataList.length > 0 && globalRouteData.length > 0) {
            processRanking(min, max);
            return;
        }

        Promise.all([
            fetch(MECH_CSV).then(res => res.text()),
            fetch(ROUTE_CSV).then(res => res.text())
        ])
        .then(([mechCsv, routeCsv]) => {
            globalMechDataList = parseCSV(mechCsv);
            globalRouteData = parseCSV(routeCsv);
            processRanking(min, max);
        })
        .catch(error => {
            $('#unit-error').text("CSV読み込みエラー: " + error.message).show();
        });
    }

    function processRanking(min, max) {
        const { nameIdx } = getMechColumnIndices();

        const validMechs = globalMechDataList.filter(row => {
            if (!row || row.length === 0) return false;
            let no = parseNumber(row[0]);
            return no > 0;
        });

        const filtered = validMechs.filter(row => {
            let no = parseNumber(row[0]);
            return no >= min && no <= max;
        });

        if (filtered.length === 0) {
            $('#unit-error').text(`範囲内の機体が見つかりません(No ${min}-${max})`).show();
            $('#rank-fame').html("データなし");
            $('#rank-point').html("データなし");
            return;
        }
        $('#unit-error').hide();

        let processedUnits = filtered.map(row => {
            let name = row[nameIdx] !== undefined ? row[nameIdx] : "-";
            let costs = calculateCumulativeCost(name);
            return {
                name: name,
                totalFame: costs.totalFame,
                totalCredit: costs.totalCredit
            };
        });

        displayCustomRank(processedUnits, 'totalFame', '#rank-fame', '総名声', '#00d4ff');
        displayCustomRank(processedUnits, 'totalCredit', '#rank-point', '総クレジット', '#ffeb3b');
    }

    function displayCustomRank(dataArray, sortKey, targetId, labelName, valColor) {
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

    // 初期化実行（スクランブルデータを事前に読み込んでから各種初期化）
    loadScrambleData().always(() => {
        initHayamiTable();
        refreshTodayTab();
    });
});
