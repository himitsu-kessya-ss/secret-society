// briefing/briefing-api.js

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxJFwDlx71xhfSF3mp6cSK46zog3cSM7kr_3tkGocyQJpnfbzQ8dDPWSjfxG5C7lcdejA/exec';

// サーバーから全イベントデータを取得
async function loadEventsFromServer(isBackground = false) {
    if (!GAS_URL) {
        if (!isBackground) renderEventList();
        return;
    }

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && Array.isArray(data.events) && data.events.length > 0) {
            events = data.events;
        }
    } catch (e) {
        console.warn("サーバーからのデータ取得に失敗しました。現在のデータを維持します。", e);
    }

    if (!isBackground) {
        if (!currentEventId) {
            renderEventList();
        } else {
            const ev = events.find(e => e.id === currentEventId);
            if (ev) {
                renderMemberTable(ev);
                renderTacticsTable(ev);
            }
        }
    } else {
        if (currentEventId) {
            const ev = events.find(ev => ev.id === currentEventId);
            if (ev) calculateStats();
        }
    }
}

// 【完全安定版】現在の全イベント配列をサーバーへ一括保存する
async function saveAllEventsToServer() {
    if (!GAS_URL) return;
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: events })
        });
        console.log("全イベントデータをサーバーに一括保存しました");
    } catch (e) {
        console.error("サーバーへの保存に失敗しました", e);
        alert('保存に失敗しました。通信環境を確認してください。');
    }
}

// 管理者パスワードの照合（GAS側で { action: 'verifyAdmin', adminPw } を受け取れる構成向け）
async function verifyAdminPasswordOnServer(adminPw) {
    if (!adminPw) return { ok: false, reason: 'empty' };

    if (!GAS_URL) {
        return { ok: adminPw === 'p@ssw0rd', mode: 'local' };
    }

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'verifyAdmin', adminPw: adminPw })
        });

        // no-corsや非JSONレスポンスの場合はローカル照合にフォールバック
        if (!response.ok) {
            return { ok: adminPw === 'p@ssw0rd', mode: 'fallback' };
        }

        const result = await response.json();
        if (result && typeof result.valid === 'boolean') {
            return { ok: result.valid, mode: 'server' };
        }

        // GAS側が verifyAdmin 未実装で通常の保存応答などを返した場合のフォールバック
        return { ok: adminPw === 'p@ssw0rd', mode: 'fallback' };
    } catch (e) {
        console.warn("サーバーでの管理者認証に失敗したため、ローカル照合にフォールバックします。", e);
        return { ok: adminPw === 'p@ssw0rd', mode: 'fallback' };
    }
}

// 手動同期ボタン用
async function manualLoadFromServer() {
    await loadEventsFromServer(false);
    alert('サーバーから最新データを読み込みました！');
}
