// ==========================================
// 1. 武器庫シミュレーション設定データ
// ==========================================
const SPECIAL_CUSTOM_CONFIG = {
    rename: { name: "名称変更", fame: 20, cr: 300000 },
    universal: { name: "限定解除", fame: 500, cr: 10000000 },
    limitBreak: { name: "上限解放", fame: 100, cr: 10000000 },
    elementChange: { name: "属性変更", fame: 0, cr: 30000000 }
};

const UPGRADE_CONFIG = {
    power: { name: "威力", rate: 0.03, baseCr: 4000000, unit: "%" },
    ammo: { name: "弾数", value: 1, baseCr: 2000000, unit: "発" },
    energy: { name: "省エネ", value: -1, baseCr: 800000, unit: "" },
    attacks: { name: "攻撃回数 (HIT)", value: 1, baseCr: 4000000, unit: "回" },
    minRange: { name: "最低射程", value: -1, baseCr: 400000, unit: "" },
    maxRange: { name: "最大射程", value: 1, baseCr: 2000000, unit: "" },
    weight: { name: "軽量化", value: -1, baseCr: 800000, unit: "" }
};

// グローバル変数：CSVから読み込んだ武器データを格納する配列
let csvWeaponsData = [];

// ==========================================
// 2. CSV/TXT 読み込み＆初期化処理
// ==========================================
async function loadData() {
    try {
        let resW = await fetch('arms_weponlist.csv').catch(() => null);
        if (!resW || !resW.ok) {
            resW = await fetch('arms/arms_weponlist.csv').catch(() => null);
        }
        if (resW && resW.ok) {
            const txtW = await resW.text();
            renderTable('weapon', txtW);
            csvWeaponsData = parseCSVToObjects(txtW);
        }

        initBaseWeaponOptions();
        initUpgradeInputs();
        initSpecialLabels();
        calculateSimulation();

        let resE = await fetch('装備一覧.csv').catch(() => null);
        if (!resE || !resE.ok) {
            resE = await fetch('arms/装備一覧.csv').catch(() => null);
        }
        if (resE && resE.ok) {
            const txtE = await resE.text();
            renderTable('equip', txtE);
        }

        let resS = await fetch('武器庫.txt').catch(() => null);
        if (!resS || !resS.ok) {
            resS = await fetch('arms/武器庫.txt').catch(() => null);
        }
        const sysContent = document.getElementById('system-content');
        if (sysContent) {
            if (resS && resS.ok) {
                sysContent.innerText = await resS.text();
            } else {
                sysContent.innerText = "武器庫の解説テキストが見つかりませんでした。";
            }
        }

        updateSearchOptions();
    } catch (e) {
        console.error("データ読み込みエラー:", e);
    }
}

// テーブル描画用
function renderTable(type, csvData) {
    const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== '');
    if (rows.length === 0) return;
    
    const headers = rows[0].split(',');
    const headEl = document.getElementById(`${type}-head`);
    if (headEl) {
        headEl.innerHTML = headers.map(h => `<th>${h.trim().replace(/^["']|["']$/g, '')}</th>`).join('');
    }
    
    const bodyEl = document.getElementById(`${type}-body`);
    if (bodyEl) {
        const body = rows.slice(1).map(row => {
            const cols = row.split(',');
            return `<tr>${cols.map(c => `<td>${c.trim().replace(/^["']\vert{}["']$/g, '')}</td>`).join('')}</tr>`;
        }).join('');
        bodyEl.innerHTML = body;
    }
}

// CSVテキストをオブジェクトの配列に変換するヘルパー関数
function parseCSVToObjects(text) {
    const rows = text.trim().split(/\r?\n/).filter(row => row.trim() !== '');
    if (rows.length < 2) return [];

    const headers = rows[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const result = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',').map(val => val.trim().replace(/^["']|["']$/g, ''));
        const obj = {};
        headers.forEach((header, index) => {
            let val = cols[index] !== undefined ? cols[index] : '';
            if (!isNaN(val) && val !== '') {
                val = Number(val);
            }
            obj[header] = val;
        });
        result.push(obj);
    }
    return result;
}

// ==========================================
// 3. タブ切り替え・検索処理
// ==========================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(tabName);
    if (targetTab) targetTab.style.display = 'block';
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    const searchWrapper = document.getElementById('search-wrapper');
    if (searchWrapper) {
        searchWrapper.style.visibility = (tabName === 'system' || tabName === 'simulation') ? 'hidden' : 'visible';
    }
    
    updateSearchOptions();
    const searchBox = document.getElementById('search-box');
    if (searchBox) searchBox.value = '';
    filterData();
}

function updateSearchOptions() {
    const activeTab = document.querySelector('.tab-content[style*="block"], .tab-content:not([style*="none"])');
    if (!activeTab || activeTab.id === 'simulation' || activeTab.id === 'system') return;
    
    const headers = activeTab.querySelectorAll('th');
    const select = document.getElementById('search-column');
    if (!select) return;
    
    let options = '<option value="all">すべての項目</option>';
    headers.forEach((th, index) => {
        options += `<option value="${index}">${th.innerText}</option>`;
    });
    select.innerHTML = options;
}

function filterData() {
    const searchBox = document.getElementById('search-box');
    const searchCol = document.getElementById('search-column');
    if (!searchBox || !searchCol) return;

    const input = searchBox.value.toUpperCase();
    const colIndex = searchCol.value;
    const activeTab = document.querySelector('.tab-content[style*="block"], .tab-content:not([style*="none"])');
    if (!activeTab || activeTab.id === 'simulation' || activeTab.id === 'system') return;

    const rows = activeTab.querySelectorAll('tbody tr');
    rows.forEach(row => {
        let match = false;
        const cells = row.getElementsByTagName('td');
        if (colIndex === "all") {
            match = row.innerText.toUpperCase().indexOf(input) > -1;
        } else {
            const targetCell = cells[colIndex];
            if (targetCell && targetCell.innerText.toUpperCase().indexOf(input) > -1) match = true;
        }
        row.style.display = match ? "" : "none";
    });
}

// ==========================================
// 4. 武器庫シミュレーション関連の関数群
// ==========================================

function initBaseWeaponOptions() {
    const select = document.getElementById('baseWeaponSelect');
    if (!select) return;
    select.innerHTML = '';
    
    if (csvWeaponsData.length === 0) {
        select.innerHTML = '<option value="">武器データがありません</option>';
        return;
    }

    csvWeaponsData.forEach((w, index) => {
        const name = w.名称 || w.name || w.武器名 || `武器 #${index + 1}`;
        const price = w.価格 || w.price || w.購入価格 || 0;
        select.innerHTML += `<option value="${index}">${name} (価格: ${Number(price).toLocaleString()} Cr)</option>`;
    });
}

function initUpgradeInputs() {
    const container = document.getElementById('upgradeControls');
    if (!container) return;
    container.innerHTML = '';

    for (const key in UPGRADE_CONFIG) {
        const item = UPGRADE_CONFIG[key];
        let changeStr = item.rate ? `+${item.rate * 100}%(切り上げ)` : (item.value > 0 ? `+${item.value}` : `${item.value}`);
        
        container.innerHTML += `
            <div class="sim-form-group" id="group_${key}">
                <label>${item.name} (${changeStr} / 基準Cr: ${item.baseCr.toLocaleString()})</label>
                <div class="counter-control">
                    <button class="counter-btn" onclick="changeCount('${key}', -1)">-</button>
                    <input type="number" id="count_${key}" value="0" min="-10" max="20" onchange="calculateSimulation()">
                    <button class="counter-btn" onclick="changeCount('${key}', 1)">+</button>
                </div>
            </div>
        `;
    }
}

function initSpecialLabels() {
    const cfg = SPECIAL_CUSTOM_CONFIG;
    const labelRename = document.getElementById('labelRename');
    const labelUniversal = document.getElementById('labelUniversal');
    const labelLimitBreak = document.getElementById('labelLimitBreak');
    const labelElementChange = document.getElementById('labelElementChange');

    if (labelRename) labelRename.innerHTML = `${cfg.rename.name} <span style="color:#aaa; font-weight:normal;">(固定: ${cfg.rename.cr.toLocaleString()}Cr / 名声${cfg.rename.fame})</span>`;
    if (labelUniversal) labelUniversal.innerHTML = `${cfg.universal.name} <span style="color:var(--accent-color);">[固定: ${cfg.universal.cr.toLocaleString()}Cr / 名声${cfg.universal.fame}]</span>`;
    if (labelLimitBreak) labelLimitBreak.innerHTML = `${cfg.limitBreak.name} <span style="color:var(--accent-color);">[固定: ${cfg.limitBreak.cr.toLocaleString()}Cr / 名声${cfg.limitBreak.fame}]</span>`;
    if (labelElementChange) labelElementChange.innerHTML = `${cfg.elementChange.name} <span style="color:var(--accent-color);">[固定: ${cfg.elementChange.cr.toLocaleString()}Cr]</span>`;
}

function changeMastery(amount) {
    const input = document.getElementById('playerMastery');
    if (!input) return;
    let val = parseInt(input.value) + amount;
    if (val < 200) val = 200;
    input.value = val;
    calculateSimulation();
}

function changeCount(key, amount) {
    const input = document.getElementById(`count_${key}`);
    if (!input) return;
    let val = parseInt(input.value) + amount;
    let min = parseInt(input.min);
    let max = parseInt(input.max);
    if (val >= min && val <= max) {
        input.value = val;
        calculateSimulation();
    }
}

function calculateSimulation() {
    if (csvWeaponsData.length === 0) return;

    const masteryInput = document.getElementById('playerMastery');
    if (!masteryInput) return;

    let mastery = parseInt(masteryInput.value) || 200;
    if (mastery < 200) mastery = 200;

    const costMultiplier = 1 + (mastery - 200) * 0.005;

    const selectEl = document.getElementById('baseWeaponSelect');
    const baseIndex = selectEl ? selectEl.value : 0;
    const base = csvWeaponsData[baseIndex] || csvWeaponsData[0] || {};

    const baseName = base.名称 || base.name || base.武器名 || "不明な武器";
    const basePrice = Number(base.価格 || base.price || base.購入価格 || 0);
    const baseElement = base.属性 || base.element || "ビーム";
    const basePower = Number(base.ダメージ || base.威力 || base.power || 100);
    const baseAmmo = Number(base.弾数 !== undefined ? base.弾数 : (base.ammo !== undefined ? base.ammo : 10));
    const baseEnergy = Number(base.消費EN || base.省エネ || base.EN || base.energy || 10);
    const baseMinRange = Number(base.最低射程 || base.minRange || 1);
    const baseMaxRange = Number(base.最大射程 || base.maxRange || 3);
    const baseWeight = Number(base.重量 || base.軽量化 || base.weight || 50);
    const baseAttacks = Number(base.HIT || base.攻撃回数 || base.attacks || 1);

    // 属性変更チェックボックスとセレクトボックスの連動制御
    const elementCheck = document.getElementById('elementChangeCheck');
    const elementSelectGroup = document.getElementById('elementSelectGroup');
    const elementSelect = document.getElementById('elementSelect');
    
    if (elementSelectGroup) {
        elementSelectGroup.style.display = (elementCheck && elementCheck.checked) ? "block" : "none";
    }

    let currentElement = baseElement;
    if (elementCheck && elementCheck.checked && elementSelect) {
        currentElement = elementSelect.value;
    }

    const ammoGroup = document.getElementById('group_ammo');
    const ammoInput = document.getElementById('count_ammo');
    if (baseAmmo === 0) {
        if (ammoGroup) ammoGroup.style.opacity = "0.3";
        if (ammoInput) ammoInput.value = 0;
    } else {
        if (ammoGroup) ammoGroup.style.opacity = "1.0";
    }

    const counts = {};
    for (const key in UPGRADE_CONFIG) {
        const el = document.getElementById(`count_${key}`);
        counts[key] = el ? (parseInt(el.value) || 0) : 0;
    }

    // --- 1. ステータス計算 ---
    let currentPower = basePower;
    for (let i = 0; i < Math.abs(counts.power); i++) {
        const diff = Math.ceil(currentPower * UPGRADE_CONFIG.power.rate);
        if (counts.power > 0) {
            currentPower += diff;
        } else {
            currentPower -= diff;
        }
    }

    const simData = {
        element: currentElement,
        power: currentPower,
        ammo: baseAmmo === 0 ? 0 : Math.max(1, baseAmmo + (counts.ammo * UPGRADE_CONFIG.ammo.value)),
        energy: Math.max(1, baseEnergy + (counts.energy * UPGRADE_CONFIG.energy.value)),
        minRange: Math.max(1, baseMinRange + (counts.minRange * UPGRADE_CONFIG.minRange.value)),
        maxRange: Math.max(1, baseMaxRange + (counts.maxRange * UPGRADE_CONFIG.maxRange.value)),
        weight: Math.max(5, baseWeight + (counts.weight * UPGRADE_CONFIG.weight.value)),
        attacks: Math.max(1, baseAttacks + (counts.attacks * UPGRADE_CONFIG.attacks.value))
    };

    let totalModCount = 0;
    for (const key in counts) {
        if (counts[key] > 0) totalModCount += counts[key];
    }

    const simCost = 1000 + (totalModCount * 50);

    // --- 2. 比較テーブル描画 ---
    const tbody = document.getElementById('comparisonTableBody');
    const universalCheck = document.getElementById('universalCheck');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td>装備制限</td>
                <td>専用機限定</td>
                <td style="color:var(--accent-color); font-weight:bold;">
                    ${universalCheck && universalCheck.checked ? "汎用（全機体装備可）" : "専用機限定"}
                </td>
            </tr>
            <tr>
                <td>属性</td>
                <td>${baseElement}</td>
                <td style="color:var(--accent-color); font-weight:bold;">${simData.element}</td>
            </tr>
            <tr>
                <td>ダメージ (威力)</td>
                <td>${basePower.toLocaleString()}</td>
                <td>${simData.power.toLocaleString()} <span class="diff-plus">(${simData.power - basePower >= 0 ? '+' : ''}${simData.power - basePower})</span></td>
            </tr>
            <tr>
                <td>弾数</td>
                <td>${baseAmmo === 0 ? "無限" : baseAmmo}</td>
                <td>${baseAmmo === 0 ? "無限" : simData.ammo + ' <span class="diff-plus">(' + (simData.ammo - baseAmmo >= 0 ? '+' : '') + (simData.ammo - baseAmmo) + ')</span>'}</td>
            </tr>
            <tr>
                <td>消費EN (省エネ)</td>
                <td>${baseEnergy}</td>
                <td>${simData.energy} <span class="diff-plus">(${simData.energy - baseEnergy >= 0 ? '+' : ''}${simData.energy - baseEnergy})</span></td>
            </tr>
            <tr>
                <td>最低射程</td>
                <td>${baseMinRange}</td>
                <td>${simData.minRange} <span class="diff-plus">(${simData.minRange - baseMinRange >= 0 ? '+' : ''}${simData.minRange - baseMinRange})</span></td>
            </tr>
            <tr>
                <td>最大射程</td>
                <td>${baseMaxRange}</td>
                <td>${simData.maxRange} <span class="diff-plus">(${simData.maxRange - baseMaxRange >= 0 ? '+' : ''}${simData.maxRange - baseMaxRange})</span></td>
            </tr>
            <tr>
                <td>重量 (軽量化)</td>
                <td>${baseWeight}</td>
                <td>${simData.weight} <span class="diff-plus">(${simData.weight - baseWeight >= 0 ? '+' : ''}${simData.weight - baseWeight})</span></td>
            </tr>
            <tr>
                <td>HIT (攻撃回数)</td>
                <td>${baseAttacks}</td>
                <td>${simData.attacks} <span class="diff-plus">(${simData.attacks - baseAttacks >= 0 ? '+' : ''}${simData.attacks - baseAttacks})</span></td>
            </tr>
            <tr>
                <td>週の維持費</td>
                <td>-</td>
                <td style="color:var(--accent-color);">${simCost.toLocaleString()} Cr/週</td>
            </tr>
        `;
    }

    // --- 3. 明細とコスト合計計算（累進課金ルール適用） ---
    let receiptHTML = '';
    let totalCr = basePrice;
    let totalFame = 0;

    receiptHTML += `<div class="receipt-item"><span>ベース武器: ${baseName}</span><span>${basePrice.toLocaleString()} Cr</span></div>`;

    const customNameInput = document.getElementById('customNameInput');
    const customName = customNameInput ? customNameInput.value.trim() : "";
    if (customName !== "") {
        totalCr += SPECIAL_CUSTOM_CONFIG.rename.cr;
        totalFame += SPECIAL_CUSTOM_CONFIG.rename.fame;
        receiptHTML += `<div class="receipt-item"><span>- 名称変更 (固定)</span><span>${SPECIAL_CUSTOM_CONFIG.rename.cr.toLocaleString()} Cr</span></div>`;
    }

    for (const key in UPGRADE_CONFIG) {
        const count = counts[key];
        if (count > 0) {
            let itemTotalCost = 0;
            for (let i = 1; i <= count; i++) {
                let tierMultiplier = Math.ceil(i / 2);
                let singleCost = Math.round(UPGRADE_CONFIG[key].baseCr * costMultiplier * tierMultiplier);
                itemTotalCost += singleCost;
            }

            totalCr += itemTotalCost;
            receiptHTML += `<div class="receipt-item"><span>- ${UPGRADE_CONFIG[key].name}強化 x ${count}</span><span>${itemTotalCost.toLocaleString()} Cr</span></div>`;
        } else if (count < 0) {
            receiptHTML += `<div class="receipt-item"><span>- ${UPGRADE_CONFIG[key].name}ダウン x ${Math.abs(count)}</span><span>0 Cr (無料)</span></div>`;
        }
    }

    const limitBreakCheck = document.getElementById('limitBreakCheck');

    if (universalCheck && universalCheck.checked) {
        totalCr += SPECIAL_CUSTOM_CONFIG.universal.cr;
        totalFame += SPECIAL_CUSTOM_CONFIG.universal.fame;
        receiptHTML += `<div class="receipt-item"><span>- ${SPECIAL_CUSTOM_CONFIG.universal.name} (固定)</span><span>${SPECIAL_CUSTOM_CONFIG.universal.cr.toLocaleString()} Cr</span></div>`;
    }

    if (limitBreakCheck && limitBreakCheck.checked) {
        totalCr += SPECIAL_CUSTOM_CONFIG.limitBreak.cr;
        totalFame += SPECIAL_CUSTOM_CONFIG.limitBreak.fame;
        receiptHTML += `<div class="receipt-item"><span>- ${SPECIAL_CUSTOM_CONFIG.limitBreak.name} (固定)</span><span>${SPECIAL_CUSTOM_CONFIG.limitBreak.cr.toLocaleString()} Cr</span></div>`;
    }

    if (elementCheck && elementCheck.checked) {
        totalCr += SPECIAL_CUSTOM_CONFIG.elementChange.cr;
        totalFame += SPECIAL_CUSTOM_CONFIG.elementChange.fame;
        receiptHTML += `<div class="receipt-item"><span>- ${SPECIAL_CUSTOM_CONFIG.elementChange.name} (${currentElement})</span><span>${SPECIAL_CUSTOM_CONFIG.elementChange.cr.toLocaleString()} Cr</span></div>`;
    }

    const receiptItemsEl = document.getElementById('receiptItems');
    const totalCreditEl = document.getElementById('totalCredit');
    const totalFameEl = document.getElementById('totalFame');

    if (receiptItemsEl) receiptItemsEl.innerHTML = receiptHTML;
    if (totalCreditEl) totalCreditEl.innerText = totalCr.toLocaleString() + " Cr";
    // 名声の単位（Pt等）を外して数値のみ表示
    if (totalFameEl) totalFameEl.innerText = totalFame.toLocaleString();
}

// ページ読み込み時にデータを取得開始
loadData();
