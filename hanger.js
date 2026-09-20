const GAS_URL = "https://script.google.com/macros/s/AKfycbxbNqD5XbkQFOEcRXvL5XQY5J4B1Woq2T1v033J-3qm-OaX9cpFG4Pol1RyRd_tkQG-_g/exec";
const CSV_URL = "unit_26.3.24.csv";
const PILOTS = ["オロ〇ミン", "ライナセロス", "カイジン", "炎のナイト", "Net", "なぎさ", "オズナ", "エル・シエル", "アルトリア","かみねこ", "ボブ", "ナメレス", "Yggdrasill", "マルク"];

let masterData = [];
let cloudData = [];
let activePilot = PILOTS[0];
let table = null;

$(document).ready(async function() {
    initTabs();
    await loadCSV();
    await fetchCloudData();
    $("#overlay").fadeOut();
});

function initTabs() {
    const $tw =$('#memberTabs');
    PILOTS.forEach(p => {
        $('<button class="tab-btn"></button>').text(p).toggleClass('active', p === activePilot)
            .on('click', function() {
                activePilot = p; $('.tab-btn').removeClass('active');$(this).addClass('active');
                renderTable();
            }).appendTo($tw);
    });
}

async function loadCSV() {
    return new Promise(res => {
        Papa.parse(CSV_URL, { download: true, header: true, skipEmptyLines: true, complete: (r) => { masterData = r.data; res(); } });
    });
}

async function fetchCloudData() {
    try { cloudData = await $.getJSON(GAS_URL); renderTable(); } catch(e) { console.error(e); }
}

function renderTable() {
    if (table) { table.destroy(); $('#tableHeader, #tableBody').empty(); }

    const baseKeys = Object.keys(masterData[0]);
    const headers = ["BAY", "ACTION", "PILOT MEMO", ...baseKeys];
    const $theadTr =$('<tr></tr>');
    headers.forEach(h => $theadTr.append(`<th>${h}</th>`));
    $('#tableHeader').append($theadTr);

    const pilotUnits = cloudData.filter(d => d.memberName === activePilot);

    // BAYを15まで表示
    for (let i = 1; i <= 15; i++) {
        const reg = pilotUnits.find(u => String(u.slotIndex) === String(i));
        const unit = reg ? masterData.find(m => String(m.No) === String(reg.unitNo)) : null;
        const $tr =$('<tr></tr>');

        $tr.append(`<td class="bay-cell">BAY-${String(i).padStart(2, '0')}</td>`);
        
        if (unit) {
            $tr.append(`<td><button class="action-btn del-btn" onclick="updateSlot(${i}, '', '')">予備役</button></td>`);
            $tr.append(`<td><input type="text" class="memo-input" id="memo-${i}" value="${reg.note || ''}" onchange="handleSave(${i})"></td>`);
            
            baseKeys.forEach((key) => {
                let val = unit[key] || "";
                if (key === "No" && val !== "") {
                    const nameVal = unit["機体名"] || "";
                    const formBaseUrl = "https://docs.google.com/forms/d/e/1FAIpQLSc1qt_Bgvh8kwdOUtjc5qPOKl1cGoBn0jVaHW1E5oBMCIonfQ/viewform";
                    const entryIdNo = "entry.701929867";
                    const entryIdName = "entry.501950524";
                    const formUrl = `${formBaseUrl}?${entryIdNo}=${encodeURIComponent(val)}&${entryIdName}=${encodeURIComponent(nameVal)}&usp=pp_url`;
                    $tr.append(`<td><a href="${formUrl}" target="_blank" class="no-link">${val}</a></td>`);
                } else {
                    $tr.append(`<td>${val}</td>`);
                }
            });
        } else {
            $tr.append(`<td><button class="action-btn reg-btn" onclick="handleSave(${i})">配備</button></td>`);
            $tr.append(`<td><input type="text" class="memo-input" id="memo-${i}" placeholder="..."></td>`);
            $tr.append(`<td><input type="number" class="deploy-input" id="in-${i}" placeholder="No."></td>`);
            for(let j=1; j < baseKeys.length; j++) $tr.append('<td></td>');
        }
        $('#tableBody').append($tr);
    }

    table = $('#hangarTable').DataTable({
        scrollY: "calc(100vh - 230px)",
        scrollX: true,
        paging: false,
        info: false,
        fixedColumns: { left: 5 }, // BAY, ACTION, MEMO, No, 機体名まで固定
        dom: 'rti',
        ordering: false
    });
    $('#search-box').on('input', function() { table.search(this.value).draw(); });
}

async function handleSave(slot) {
    const no = $(`#in-${slot}`).val() || cloudData.find(d => d.memberName === activePilot && String(d.slotIndex) === String(slot))?.unitNo;
    const note = $(`#memo-${slot}`).val();
    if (no) await updateSlot(slot, no, note);
}

async function updateSlot(slot, no, note) {
    $("#overlay").show();
    await $.post(GAS_URL, JSON.stringify({ memberName: activePilot, slotIndex: String(slot), unitNo: no, note: note }));
    await fetchCloudData();
    $("#overlay").hide();
}
