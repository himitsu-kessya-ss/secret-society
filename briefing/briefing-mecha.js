// briefing/briefing-mecha.js

async function loadMechaCsv() {
    try {
        const response = await fetch('GL)機体一覧 - 機体一覧.csv');
        if (!response.ok) throw new Error('CSV読み込み失敗');
        const csvText = await response.text();
        const lines = csvText.split('\n');

        MECHA_DB = {};
        mechaListArray = [];

        lines.forEach((line) => {
            if (!line.trim()) return;
            const cols = line.split(',').map(col => col.replace(/^"|"$/g, '').trim());

            if (cols.length >= 18) {
                const mechaNo = cols[0];   
                const mechaName = cols[1]; 
                const hpVal = Number(cols[3]) || 0;     
                const costVal = Number(cols[17]) || 0;  

                if (mechaName) {
                    MECHA_DB[mechaName] = { hp: hpVal, cost: costVal, no: mechaNo };
                    mechaListArray.push({ name: mechaName, hp: hpVal, cost: costVal, no: mechaNo });
                }
            }
        });
    } catch (err) {
        MECHA_DB = {
            "ガンダム": { hp: 384, cost: 38, no: "1" },
            "バンシィ": { hp: 576, cost: 64, no: "2" },
            "ガリルナガン": { hp: 700, cost: 72, no: "3" }
        };
        mechaListArray = Object.keys(MECHA_DB).map(k => ({ name: k, ...MECHA_DB[k] }));
    }
}

function openMechaSearchModal(rowIndex) {
    editingRowIndex = rowIndex;
    document.getElementById('input-mecha-query').value = '';
    renderMechaSearchResults(mechaListArray);
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-mecha-search').classList.remove('hidden');
}

function filterMechaList() {
    const query = document.getElementById('input-mecha-query').value.toLowerCase();
    const filtered = mechaListArray.filter(m => 
        m.name.toLowerCase().includes(query) || String(m.no).toLowerCase().includes(query)
    );
    renderMechaSearchResults(filtered);
}

function renderMechaSearchResults(list) {
    const container = document.getElementById('mecha-search-results');
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: var(--text-muted); text-align:center;">該当する機体が見つかりません</div>';
        return;
    }
    list.forEach(m => {
        const item = document.createElement('div');
        item.className = 'mecha-search-item';
        item.innerHTML = `<span>[No.${m.no}] <strong>${m.name}</strong></span> <span style="color:var(--accent);">HP: ${m.hp} / コスト: ${m.cost}</span>`;
        item.onclick = () => selectMecha(m);
        container.appendChild(item);
    });
}

function selectMecha(m) {
    const ev = events.find(e => e.id === currentEventId);
    if (editingRowIndex !== null && ev.tactics[editingRowIndex]) {
        const row = ev.tactics[editingRowIndex];
        row.mecha = m.name;
        row.hp = m.hp;
        const playerRank = ev.members[row.player] ? ev.members[row.player].rank : null;
        const addCost = playerRank ? (RANK_MASTER[playerRank] || 0) : 0;
        row.actualCost = m.cost + addCost;

        renderTacticsTable(ev);
    }
    closeModal();
}
