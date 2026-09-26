// グローバル変数：今日の加算値（HC周期）を保持する変数
let todayAdditionValue = 0;

$(document).ready(function() {
    
    // タブ切り替えの制御
    $('.tab-btn').on('click', function() {
        $('.tab-btn').removeClass('active');$(this).addClass('active');
        
        const type = $(this).data('type');
        if (type === 'today') {
            $('#today-tool').show();
            $('#text-content-display').hide();
            $('#content-frame').hide();
            $('#static-table-area').hide();
        } else if (type === 'static') {
            $('#today-tool').hide();
            $('#text-content-display').hide();
            $('#content-frame').hide();
            $('#static-table-area').show();
        }
    });

    // 【重要】ページ読み込み時に日付を自動判定し、今日の加算値を取得する処理
    // （hunter_data.js に定義されているデータ構造に合わせて自動で値をキャッチします）
    detectTodayInfo();

    // 前日の戦闘数が入力されたとき、または変更されたときにスケジュール表を計算・更新
    $('#input-battle').on('input', function() {
        calculateSchedule();
    });

});

// 今日の日付から加算値（周期）を自動取得する関数
function detectTodayInfo() {
    // 既存の仕組み（hunter_data.js等）で #today-info や日付から加算値がセットされるタイミングをフック、
    // または日付計算による加算値の抽出を行います。
    // ここでは、お使いの環境で「今日の加算値」が画面上のどこに表示されるか、
    // あるいは hunter_data から自動取得されるロジックと競合しないよう、監視または安全に取得する処理を入れます。
    
    // 例として、もし #today-info の中身が書き換わったときに数値を抽出し、自動でスケジュールも再計算するようにします
    const observer = new MutationObserver(function(mutations) {
        const text = $('#today-info').text();
        // テキスト内から加算値の数値を読み取る（例：「加算値: 111」などのパターンに対応）
        const match = text.match(/加算値[^\d]*(\d+)/);
        if (match) {
            todayAdditionValue = parseInt(match[1]);
            // すでに前日の戦闘数が入力されていれば表を自動更新
            if ($('#input-battle').val()) {
                calculateSchedule();
            }
        }
    });

    const target = document.getElementById('today-info');
    if (target) {
        observer.observe(target, { childList: true, characterData: true, subtree: true });
    }
}

// 最初のHC計算および＋1500戦スケジュールを構築するメイン関数
function calculateSchedule() {
    const prevBattle = parseInt($('#input-battle').val());
    const calcRes = $('#calc-res');
    const scheduleArea = document.getElementById('schedule-area');
    const tbody = document.querySelector('#schedule-table tbody');

    if (isNaN(prevBattle) || prevBattle <= 0) {
        calcRes.text('前日の数値を入力してください');
        if (scheduleArea) scheduleArea.style.display = 'none';
        return;
    }

    // HCの周期＝今日の加算値（まだ自動取得できていない場合の予備としてデフォルト111などを持たせる）
    let hcInterval = todayAdditionValue > 0 ? todayAdditionValue : 111; 

    // 今日の最初のHCを計算（前日最終戦闘数 ＋ 最初のHCまでの契機など。従来の計算式に合わせています）
    // ※もし元の「①今日の最初のHCを計算」で表示されていた計算結果の数値をそのまま使う場合：
    let firstHcBattle = prevBattle + hcInterval; // （必要に応じてここの計算式を微調整可能です）

    calcRes.html(`前日の最終戦闘数: <strong>${prevBattle}戦</strong><br>今日の最初のHC: <strong>${firstHcBattle}戦目</strong> <span style="font-size:0.85rem; color:#00d4ff;">(本日の加算値/周期: ${hcInterval})</span>`);

    // ＋1500戦までの範囲設定
    const startBattle = prevBattle + 1;
    const maxBattle = prevBattle + 1500;

    let events = {};

    // 1. HCの発生回を計算・登録（周期＝今日の加算値）
    if (hcInterval > 0) {
        let currentHc = firstHcBattle;
        let hcCount = 1;
        while (currentHc <= maxBattle) {
            if (currentHc >= startBattle) {
                if (!events[currentHc]) events[currentHc] = { hc: '', scramble: '' };
                events[currentHc].hc = `${hcCount}回目`;
            }
            currentHc += hcInterval;
            hcCount++;
        }
    }

    // 2. スクランブルの発生回を計算・登録（総戦闘回数の158戦周期）
    const scrambleInterval = 158;
    let sBattle = scrambleInterval;
    while (sBattle <= maxBattle) {
        if (sBattle >= startBattle) {
            let scrambleCount = Math.floor(sBattle / scrambleInterval);
            if (!events[sBattle]) events[sBattle] = { hc: '', scramble: '' };
            events[sBattle].scramble = `${scrambleCount}回目`;
        }
        sBattle += scrambleInterval;
    }

    // 戦闘回数の昇順に並び替え
    const sortedBattles = Object.keys(events).map(Number).sort((a, b) => a - b);

    tbody.innerHTML = '';
    if (sortedBattles.length > 0) {
        scheduleArea.style.display = 'block';
        sortedBattles.forEach(battle => {
            const item = events[battle];
            const tr = document.createElement('tr');
            
            // 行ごとの色分け
            if (item.hc && item.scramble) {
                tr.className = 'row-both';
            } else if (item.scramble) {
                tr.className = 'row-scramble';
            } else {
                tr.className = 'row-hc';
            }

            tr.innerHTML = `
                <td><strong>${battle}戦</strong></td>
                <td>${item.hc || 'ー'}</td>
                <td>${item.scramble || 'ー'}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        scheduleArea.style.display = 'none';
    }
}
