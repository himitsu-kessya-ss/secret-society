// ==========================================
// アカウントページ用 データ定義ファイル
// ==========================================

// 管理者認証用パスワード
const ADMIN_PASSWORD_SECRET = "12342234"; 

// 初期登録されているアカウントリスト
const INITIAL_ACCOUNTS = [
    { id: "secret", pw: "p@ssw0rd", charaName: "管理人", role: "管理者", memo: "メインアカウント", updated: "2026-04-01 00:00" },
    { id: "pilot1", pw: "abcd1234", charaName: "パイロットA", role: "一般", memo: "テスト用", updated: "2026-04-10 12:30" }
];
