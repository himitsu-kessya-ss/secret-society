// novels.htmlで読み込む記録データ一覧ファイル
// すべての記録を public: false にすることで、公開せず保管状態にしています
const novelsData = {
    // 【1】勢力戦の記録
    serious: [
        {
            title: "【勢力戦】 秘密結社対オガ研（低コストの部）",
            date: "2026.05.23",
            url: "2026.5.27勢力戦秘密結社対オガ研低コスト.html",
            isNew: true,
            public: false // 保管用（非表示）
        },
        {
            title: "【勢力戦】 秘密結社対オガ研（高コストの部）",
            date: "2026.05.23",
            url: "2026.5.23勢力戦秘密結社対オガ研高コスト.html",
            isNew: true,
            public: false // 保管用（非表示）
        }
    ],

    // 【2】勢力内戦の記録
    internal: [
        {
            title: "春の大乱闘秘密結社ブラザーズ",
            date: "2026.04.30",
            url: "2026.4.30勢力内戦春の大乱闘秘密結社ブラザーズ.html",
            isNew: true,
            public: false // 保管用（非表示）
        },
        {
            title: "第一回タッグマッチ：エキシビジョン",
            date: "2026.03.22",
            url: "2026.3.22勢力内第一回タッグマッチエキシビジョン.html",
            isNew: false,
            public: false // 保管用（非表示）
        },
        {
            title: "第一回タッグマッチ：決勝戦",
            date: "2026.03.21",
            url: "2026.3.21勢力内第一回タッグマッチ決勝戦.html",
            isNew: false,
            public: false // 保管用（非表示）
        },
        {
            title: "第一回タッグマッチ：1回戦 第二試合",
            date: "2026.03.19",
            url: "2026.3.19勢力内第一回タッグマッチ1回戦第二試合.html",
            isNew: false,
            public: false // 保管用（非表示）
        },
        {
            title: "第一回タッグマッチ：1回戦 第一試合",
            date: "2026.03.18",
            url: "2026.3.18勢力内第一回タッグマッチ1回戦第一試合.html",
            isNew: false,
            public: false // 保管用（非表示）
        }
    ],

    // 【3】勢力交流戦の記録
    exchange: [
        {
            title: "【交流戦】秘密結社 vs オガ研 （高コストの部）",
            date: "2026.03.22",
            url: "2026.4.12交流戦秘密結社対オガ研高コスト.html",
            isNew: true,
            public: false // 保管用（非表示）
        },
        {
            title: "【交流戦】秘密結社 vs オガ研 （低コストの部）",
            date: "2026.03.22",
            url: "2026.4.12交流戦秘密結社対オガ研低コスト.html",
            isNew: true,
            public: false // 保管用（非表示）
        }
    ],

    // 【4】トナメの記録
    tournament: [
        // データがない場合は空またはすべて非公開
    ]
};
