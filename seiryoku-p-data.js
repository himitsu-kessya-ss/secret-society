// ==========================================
// 秘密結社の部屋 - 勢力P管理データ (seiryoku-p-data.js)
// ==========================================

const ADMIN_PASSWORD = "p@ssw0rd";

let members = [
    { id: 1, name: "Oro🍊min", lastMonth: 36319, thisMonth: 96271, total: 132590, adjustment: 0 },
    { id: 2, name: "キュゥべえ（提督）", lastMonth: 22615, thisMonth: 41587, total: 64202, adjustment: 0 },
    { id: 3, name: "炎のナイト", lastMonth: 4115, thisMonth: 7338, total: 11453, adjustment: 0 },
    { id: 4, name: "ニャオハ", lastMonth: 668, thisMonth: 575, total: 1243, adjustment: 0 },
    { id: 5, name: "ハチワレ", lastMonth: 8406, thisMonth: 29808, total: 38214, adjustment: 0 },
    { id: 6, name: "リーア", lastMonth: 73, thisMonth: 182, total: 255, adjustment: 0 },
    { id: 7, name: "Yggdrasill", lastMonth: 327, thisMonth: 63742, total: 64069, adjustment: 0 },
    { id: 8, name: "ボブ", lastMonth: 2900, thisMonth: 21214, total: 24114, adjustment: 0 },
    { id: 9, name: "Marc", lastMonth: 5722, thisMonth: 198, total: 5920, adjustment: 0 },
    { id: 10, name: "ヴォルド", lastMonth: 106, thisMonth: 22010, total: 22116, adjustment: 0 },
    { id: 11, name: "Freddie", lastMonth: 14491, thisMonth: 34059, total: 48550, adjustment: 0 },
    { id: 12, name: "アルヴィス", lastMonth: 29, thisMonth: 73, total: 102, adjustment: 0 },
    { id: 13, name: "京乃 まどか", lastMonth: 21, thisMonth: 87, total: 108, adjustment: 0 },
    { id: 14, name: "シン・アスカ", lastMonth: 1263, thisMonth: 55745, total: 57008, adjustment: 0 },
    { id: 15, name: "ライナセロス", lastMonth: 5, thisMonth: 81, total: 86, adjustment: 0 },
    { id: 16, name: "キッド", lastMonth: 37, thisMonth: 129, total: 166, adjustment: 0 },
    { id: 17, name: "アラン", lastMonth: 3456, thisMonth: 544, total: 4000, adjustment: 0 },
    { id: 18, name: "アイアンサウス", lastMonth: 23, thisMonth: 19292, total: 19315, adjustment: 0 },
    { id: 19, name: "スパイク", lastMonth: 0, thisMonth: 747, total: 747, adjustment: 0 },
    { id: 20, name: "カイジン", lastMonth: 0, thisMonth: 88, total: 88, adjustment: 0 },
    { id: 21, name: "Halbert", lastMonth: 0, thisMonth: 18, total: 18, adjustment: 0 }
];

let historyData = [
    { 
        year: 2026, 
        date: "8/31", 
        totalP: 100576, 
        monthlyP: 100576, 
        rate: 100.0, 
        members: [36319, 22615, 4115, 668, 8406, 73, 327, 2900, 5722, 106, 14491, 29, 21, 1263, 5, 37, 3456, 23, 0, 0, 0] 
    },
    { 
        year: 2026, 
        date: "9/13", 
        totalP: 413113, 
        monthlyP: 312537, 
        rate: 100.0, 
        members: [96271, 41587, 7338, 575, 29808, 182, 63742, 21214, 198, 22010, 34059, 73, 87, 57008, 81, 129, 544, 19292, 747, 88, 18] 
    }
];

let eventLogs = [
    { 
        date: "2026-09-01", 
        memo: "8月分配布", 
        values: [40, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] 
    },
    { 
        date: "2026-09-05", 
        memo: "9/5勢力内戦", 
        values: [-264, -58, -17, -125, -11, -102, -70, -56, -11, -20, -10, -10, -38, -11, -10, 0, 0, 0, 0, 0, 0] 
    }
];
