// ==========================================
// 秘密結社BBS - データ管理スクリプト (bbs_data.js)
// ==========================================

// ローカルストレージからスレッドデータを取得、なければ初期データをセット
let threads = JSON.parse(localStorage.getItem('secret_bbs_threads')) || [
    {
        id: 1,
        username: '管理人',
        avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=hero1',
        content: '「秘密結社の部屋」秘密結社BBSへようこそ！攻略のコツや編成情報を自由に共有してください。',
        images: [],
        timestamp: '2026/09/16 12:00:00',
        replies: []
    }
];

// データをローカルストレージに保存する関数
function saveThreadsData() {
    localStorage.setItem('secret_bbs_threads', JSON.stringify(threads));
}
