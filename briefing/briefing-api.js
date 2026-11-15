// briefing/briefing-api.js

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxJFwDlx71xhfSF3mp6cSK46zog3cSM7kr_3tkGocyQJpnfbzQ8dDPWSjfxG5C7lcdejA/exec';

// サーバーから全イベントデータを取得
async function loadEventsFromServer(isBackground = false) {
    if (!GAS_URL) {
        initDefaultEvents();
        if (!isBackground) renderEventList();
        return;
    }

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && Array.isArray(data.events) && data.events.length > 0) {
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

// 【安全版】指定した1つのイベントだけをサーバーに追加・更新する
async function saveSingleEventToServer(targetEvent) {
    if (!GAS_URL || !targetEvent) return;
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'upsert',
                event: targetEvent
            })
        });
    } catch (e) {
        console.error("イベントの保存に失敗しました", e);
    }
}

// 【安全版】指定したイベントIDだけをサーバーから削除する（他のイベントには一切触れない）
async function deleteEventFromServer(eventId) {
    if (!GAS_URL || !eventId) return;
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete',
                eventId: eventId
            })
        });
    } catch (e) {
        console.error("イベントの削除に失敗しました", e);
    }
}

// 従来の全件保存（初期データ生成時のみ使用）
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

// 手動同期ボタン用
async function manualLoadFromServer() {
    await loadEventsFromServer(false);
    alert('サーバーから最新データを読み込みました！');
}
