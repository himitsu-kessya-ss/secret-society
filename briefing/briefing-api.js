// briefing/briefing-api.js

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxJFwDlx71xhfSF3mp6cSK46zog3cSM7kr_3tkGocyQJpnfbzQ8dDPWSjfxG5C7lcdejA/exec';

// サーバーからデータを取得
async function loadEventsFromServer(isBackground = false) {
    if (!GAS_URL) {
        initDefaultEvents();
        if (!isBackground) renderEventList();
        return;
    }

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && data.events && data.events.length > 0) {
            events = data.events;
        } else {
            initDefaultEvents();
        }
    } catch (e) {
        console.warn("サーバーからのデータ取得に失敗しました。ローカルデータを使用します。", e);
        initDefaultEvents();
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

// サーバーへ全データを保存
async function saveEventsToServer() {
    if (!GAS_URL) return;
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: events })
        });
    } catch (e) {
        console.error("サーバーへの保存に失敗しました", e);
    }
}

// 管理操作の直前に最新データを取得（上書き事故防止）
async function fetchLatestEventsBeforeAdminAction() {
    if (!GAS_URL) return;
    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && Array.isArray(data.events)) {
            events = data.events;
        }
    } catch (e) {
        console.warn("最新データの取得に失敗しました。", e);
    }
}

// 手動同期ボタン用
async function manualLoadFromServer() {
    await loadEventsFromServer(false);
    alert('サーバーから最新データを読み込みました！');
}
