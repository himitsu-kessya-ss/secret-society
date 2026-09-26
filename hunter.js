// サイト全体の挙動・計算スクリプト
$(document).ready(function() {
    
    // タブ切り替えの挙動
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

    // 前日の戦闘数が入力されたときの計算と、＋1500戦までのスケジュール表の更新
    $('#input-battle').on('input', function() {
        const prevBattle = parseInt($(this).val());
        const calcRes = $('#calc-res');
        const scheduleArea = document.getElementById('schedule-area');
        const tbody = document.querySelector('#schedule-table tbody');

        if (isNaN(prevBattle) || prevBattle <= 0) {
            calcRes.text('前日の数値を入力してください');
            scheduleArea.style.display = 'none';
            return;
        }

        // --- ① 今日の最初のHCを計算（例：前日戦闘数 ＋ 111） ---
        const startBattle = prevBattle + 1; // 翌日の最初
        const maxBattle = prevBattle + 1500; // ＋1500戦まで

        let firstHc = prevBattle + 111; 
        calcRes.html(`前日の最終: <strong>${prevBattle}戦</strong><br>今日の最初のHC目安: <strong>${firstHc}戦目</strong>`);

        // --- ② ＋1500戦までのスケジュール（HC ＆ スクランブル）の生成 ---
        let events = {};
        
        // HCの周期（例：111戦周期）
        let hcInterval = 111;
        let currentHc = firstHc;
        let hcCount = 1;
        while (currentHc <= maxBattle) {
            if (currentHc >= startBattle) {
                if (!events[currentHc]) events[currentHc] = { hc: '', scramble: '' };
                events[currentHc].hc = `${hcCount}回目`;
            }
            currentHc += hcInterval;
            hcCount++;
        }

        // スクランブルの周期（総戦闘回数の158戦周期）
        let scrambleInterval = 158;
        let sBattle = scrambleInterval;
        while (sBattle <= maxBattle) {
            if (sBattle >= startBattle) {
                let sCount = Math.floor(sBattle / scrambleInterval);
                if (!events[sBattle]) events[sBattle] = { hc: '', scramble: '' };
                events[sBattle].scramble = `${sCount}回目`;
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
                
                // 行ごとの色分けクラス設定
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
    });

});
