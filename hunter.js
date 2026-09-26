// グローバル変数として今日の加算値（周期）を保持できるように定義
let currentAddValue = 0;

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
        } else if (type === 'txt' || type === 'html') {
            $('#today-tool').hide();
            // その他のタブ表示用ロジックが元々あればここで連動
        }
    });

    // 既存の仕組み等から「今日の加算値」をフックして取得、またはプレースホルダーとしての処理
    // ※もし元々のスクリプトで window.todayAddValue などが定義されている場合はそれを参照します
    // ここではデモや既存ロジックと連携できるよう、input変更時にもスケジュール表を再描画します
    $('#input-battle').on('input', function() {
        calculateSchedule();
    });

});

// 最初のHC計算および＋1500戦スケジュールを構築する関数
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

    // 「今日の加算値」を早見表や既存データから取得する想定（取得できない場合はデフォルト値を設定）
    // ※お持ちの環境ですでに計算されている加算値（周期値）があれば、それを変数として読み込んでください
    let hcInterval = window.currentHcInterval || 111; // 加算値＝HC周期
    
    // 例としての最初のHC算出（前日最終戦闘数 ＋ 加算値 など、実際のロジックに合わせて微調整可能です）
    let firstHcBattle = prevBattle + hcInterval; 
    calcRes.html(`前日の最終戦闘数: <strong>${prevBattle}戦</strong><br>今日の最初のHC: <strong>${firstHcBattle}戦目</strong> (加算値/周期: ${hcInterval})`);

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

    // 2. スクランブルの発生回を計算・登録（158戦周期）
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
