// battles.js
document.addEventListener("DOMContentLoaded", () => {
    const eventContainer = document.getElementById('event-container');
    const loadingMsg = document.getElementById('loading-msg');

    // データが正しく読み込まれているかチェック
    if (typeof battleEvents === 'undefined') {
        loadingMsg.textContent = '戦闘データの読み込みに失敗しました（battles-data.js が見つかりません）。';
        return;
    }

    loadingMsg.style.display = 'none';
    eventContainer.innerHTML = '';

    if (battleEvents.length === 0) {
        eventContainer.innerHTML = '<p style="color: var(--sub-text); text-align: center; padding: 20px;">登録された戦闘結果はまだありません。</p>';
        return;
    }

    // イベントごとにカードを作成して並べる
    battleEvents.forEach(eventGroup => {
        const card = document.createElement('div');
        card.className = 'event-card';

        // 1階層目（イベント名ヘッダー）
        const header = document.createElement('div');
        header.className = 'event-header';
        header.innerHTML = `
            <h3 class="event-title">🏆 ${escapeHTML(eventGroup.eventName)} <span style="font-size: 0.8rem; color: var(--sub-text); font-weight: normal;">(${eventGroup.battles.length}件のログ)</span></h3>
            <span style="font-size: 0.85rem; color: var(--accent-color);">▼ 開閉</span>
        `;

        // 2階層目（イベント内の詳細データ群）
        const body = document.createElement('div');
        body.className = 'event-body';
        // ★ここを変更：デフォルトでは閉じた状態にする
        body.style.display = 'none';

        eventGroup.battles.forEach(battle => {
            const subItem = document.createElement('div');
            subItem.className = 'sub-battle-item';
            subItem.innerHTML = `
                <div class="sub-battle-info">
                    <div class="sub-battle-title">📌 ${escapeHTML(battle.roundName)}</div>
                    <div class="sub-battle-desc">${escapeHTML(battle.description || '')}</div>
                </div>
                <a href="${escapeHTML(battle.url)}" class="view-btn">詳細を見る</a>
            `;
            body.appendChild(subItem);
        });

        // アコーディオン開閉の切り替えイベント
        header.addEventListener('click', () => {
            body.style.display = (body.style.display === 'none') ? 'block' : 'none';
        });

        card.appendChild(header);
        card.appendChild(body);
        eventContainer.appendChild(card);
    });
});

// HTMLエスケープ処理（セキュリティ対策）
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
