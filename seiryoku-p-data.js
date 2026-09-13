// ==========================================
// 秘密結社の部屋 - 勢力P管理データ (seiryoku-p-data.js)
// ==========================================

// 管理者認証パスワード
const ADMIN_PASSWORD = "p@ssw0rd";

// 初期メンバーデータ（21名分）
const initialMembers = [
    { id: 1, badge: "❄️🦊", name: "Oro🍊min", machine: "ブリッツガンダム虚無空間", lastMonth: 36319, thisMonth: 96271, total: 132590, adjustment: 0 },
    { id: 2, badge: "🚢🚢", name: "キュゥべえ（提督）", machine: "ガンダイバー", lastMonth: 22615, thisMonth: 41587, total: 64202, adjustment: 0 },
    { id: 3, badge: "🔥⚡️", name: "炎のナイト", machine: "96式艦戦BLAZE", lastMonth: 4115, thisMonth: 7338, total: 11453, adjustment: 0 },
    { id: 4, badge: "🌱🐱", name: "ニャオハ", machine: "ソードインパルスSpecIIなーる", lastMonth: 668, thisMonth: 575, total: 1243, adjustment: 0 },
    { id: 5, badge: "🐈🐩", name: "ハチワレ", machine: "バンシィ・ノルン(DM)おずな", lastMonth: 8406, thisMonth: 29808, total: 38214, adjustment: 0 },
    { id: 6, badge: "👑🗡️", name: "リーア", machine: "インフィニットジャスティスアルトリア", lastMonth: 73, thisMonth: 182, total: 255, adjustment: 0 },
    { id: 7, badge: "🌏🌲", name: "Yggdrasill", machine: "デスティニーガンダムSpecIIYggdrasill", lastMonth: 327, thisMonth: 63742, total: 64069, adjustment: 0 },
    { id: 8, badge: "🎯🔫", name: "ボブ", machine: "アルトアイゼンbob", lastMonth: 2900, thisMonth: 21214, total: 24114, adjustment: 0 },
    { id: 9, badge: "🤡🃏", name: "Marc", machine: "ボールNightmare", lastMonth: 5722, thisMonth: 198, total: 5920, adjustment: 0 },
    { id: 10, badge: "🌙⚔️", name: "ヴォルド", machine: "ボール竜騎将", lastMonth: 106, thisMonth: 21936, total: 22042, adjustment: 0 },
    { id: 11, badge: "📡⚔️", name: "Freddie", machine: "ブリッツガンダムFreddie", lastMonth: 14491, thisMonth: 34059, total: 48550, adjustment: 0 },
    { id: 12, badge: "🌌🕸️", name: "アルヴィス", machine: "ペイルライダー・デュラハンアルヴィス", lastMonth: 29, thisMonth: 73, total: 102, adjustment: 0 },
    { id: 13, badge: "🌊💚", name: "京乃 まどか", machine: "ガンダイバーLast Emperor", lastMonth: 21, thisMonth: 87, total: 108, adjustment: 0 },
    { id: 14, badge: "🔥💥", name: "シン・アスカ", machine: "フォビドゥンブルー(強襲形態)あんこう", lastMonth: 1263, thisMonth: 55153, total: 56416, adjustment: 0 },
    { id: 15, badge: "🌏X", name: "ライナセロス", machine: "ゴールドフレーム天ミナCライナセロス", lastMonth: 5, thisMonth: 81, total: 86, adjustment: 0 },
    { id: 16, badge: "🎩🦯", name: "キッド", machine: "パワードジムカーディガンアル", lastMonth: 37, thisMonth: 129, total: 166, adjustment: 0 },
    { id: 17, badge: "🦊🔥", name: "アラン", machine: "ボールアラン = マクベイン", lastMonth: 3456, thisMonth: 544, total: 4000, adjustment: 0 },
    { id: 18, badge: "南軍の魂", name: "アイアンサウス", machine: "ルッグン古い鉄", lastMonth: 23, thisMonth: 19292, total: 19315, adjustment: 0 },
    { id: 19, badge: "💧🪨", name: "スパイク", machine: "ジム・ガードカスタムパブロ・ハニー", lastMonth: 0, thisMonth: 747, total: 747, adjustment: 0 },
    { id: 20, badge: "🚢🫡", name: "カイジン", machine: "ボールカイジン", lastMonth: 0, thisMonth: 88, total: 88, adjustment: 0 },
    { id: 21, badge: "🔰🔰", name: "Halbert", machine: "ガンダイバーHalbert", lastMonth: 0, thisMonth: 18, total: 18, adjustment: 0 }
];

// タブ2用の履歴データ
const initialHistory = [
    { year: 2026, date: "8/31", totalP: 100576, monthlyP: 100576, rate: 100.0, members: [36319, 22615, 4115, 668, 8406, 73, 327, 2900] },
    { year: 2026, date: "9/30", totalP: 155210, monthlyP: 54634, rate: 100.0, members: [50678, 31736, 6060, 575, 29808, 182, 63742, 21214] }
];
