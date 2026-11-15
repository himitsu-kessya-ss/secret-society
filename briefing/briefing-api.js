// briefing/briefing-api.js

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxJFwDlx71xhfSF3mp6cSK46zog3cSM7kr_3tkGocyQJpnfbzQ8dDPWSjfxG5C7lcdejA/exec';

// サーバーから全イベントデータを取得（勝手な上書きセーブを完全廃止）
async function loadEventsFromServer(isBackground = false) {
    if (!GAS_URL) {
        if (!isBackground) renderEventList();
        return;
    }

    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        if (data && Array.isArray(data.events)) {
            // サーバーから取得できた場合のみ、データを更新（空であっても勝手に上書きセーブしない）
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
        console.log("イベントの保存リクエストを送信しました:", targetEvent.title);
    } catch (e) {
        console.error("イベントの保存に失敗しました", e);
    }
}

// 【安全版】指定したイベントIDだけをサーバーから削除する
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
        console.log("イベントの削除リクエストを送信しました:", eventId);
    } catch (e) {
        console.error("イベントの削除に失敗しました", e);
    }
}

// 手動同期ボタン用
async function manualLoadFromServer() {
    await loadEventsFromServer(false);
    alert('サーバーから最新データを読み込みました！');
}
