// hunter.js
$(document).ready(function () {
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
        
        // 今日の最初のHC戦闘回数を計算
        const firstHc = Math.floor((prev / data.addVal) + 1) * data.addVal;
        $('#calc-res').html(`今日の最初のHCは <strong style="color:var(--accent-color);">${firstHc.toLocaleString()}</strong> 戦目です`);

        // --- ＋1500戦までのスケジュール生成 ---
        const startBattle = prev + 1;
        const maxBattle = prev + 1500;
        let events = {};

        // 1. HCのスケジュール（最初のHCから「今日の加算値（data.addVal）」の周期で発生）
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

        // 2. スクランブルのスケジュール（総戦闘回数の158戦周期）
        const scrambleInterval = 158;
        let sBattle = Math.ceil(startBattle / scrambleInterval) * scrambleInterval;
        while (sBattle <= maxBattle) {
            let scrambleCount = Math.round(sBattle / scrambleInterval);
            if (!events[sBattle]) events[sBattle] = { hc: '', scramble: '' };
            events[sBattle].scramble = `${scrambleCount}回目`;
            sBattle += scrambleInterval;
        }

        // 戦闘回数の昇順に並び替え
        const sortedBattles = Object.keys(events).map(Number).sort((a, b) => a - b);

        tbody.innerHTML = '';
        if (sortedBattles.length > 0) {
            scheduleArea.show();
            sortedBattles.forEach(battle => {
                const item = events[battle];
                const tr = document.createElement('tr');
                
                // 行ごとの色分け（HCのみ、スクランブルのみ、両方）
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

    // ② 今日のデータ更新 & ③ ランキング解析
    function refreshTodayTab() {
        const data = getTodayData();
        $('#today-info').html(`本日は ${data.day}日： 加算値 <b style="color:var(--accent-color);">${data.addVal}</b> / 出現No <b style="color:var(--accent-color);">${data.range}</b>`);
        
        const [min, max] = data.range.split(' - ').map(s => parseInt(s.trim()));
        loadAndRankUnits(min, max);
    }

    // ③ ユニットCSVの読み込みとソート
    function loadAndRankUnits(min, max) {
        if (typeof HUNTER_CONFIG === 'undefined' || !HUNTER_CONFIG.csvFile) return;

        Papa.parse(HUNTER_CONFIG.csvFile, {
            download: true,
            header: true,
            skipEmptyLines: true,
            trimHeaders: true, 
            complete: function(results) {
                const headers = results.meta.fields;
                
                const fameKey = headers.find(h => h.includes("名声")) || "名声";
                const pointKey = headers.find(h => {
                    const upperH = h.toUpperCase();
                    return upperH.includes("POINT") || upperH.includes("ポイント");
                }) || "POINT"; 

                const filtered = results.data.filter(u => {
                    const no = parseInt(u["No"]);
                    return no >= min && no <= max;
                });

                if (filtered.length === 0) {
                    $('#unit-error').text(`範囲内の機体が見つかりません(No ${min}-${max})`);
                    return;
                }
                $('#unit-error').hide();

                displayRank(filtered, fameKey, "#rank-fame");
                displayRank(filtered, pointKey, "#rank-point");
            },
            error: function() { $('#unit-error').text("CSV読込失敗"); }
        });
    }

    function displayRank(data, key, targetId) {
        const sorted = [...data].sort((a, b) => {
            const valA = parseFloat(String(a[key] || "0").replace(/,/g, '')) || 0;
            const valB = parseFloat(String(b[key] || "0").replace(/,/g, '')) || 0;
            return valB - valA;
        }).slice(0, 3);

        let html = '';
        sorted.forEach((u, i) => {
            const val = u[key] || 0;
            const displayVal = isNaN(parseFloat(String(val).replace(/,/g, ''))) ? val : parseFloat(String(val).replace(/,/g, '')).toLocaleString();
            
            html += `<div class="unit-card">
                        <span class="rank-badge">${i+1}</span><strong>${u["機体名"] || "No."+u["No"]}</strong>
                        <span class="unit-val">${key}: ${displayVal}</span>
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
