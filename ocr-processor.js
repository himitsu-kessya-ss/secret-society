/**
 * ocr-processor.js
 * SS解析・OCR処理および特殊能力補正ロジック
 */

import { MASTER_ABILITIES, NG_KEYWORDS } from "./ability-master.js";

// 文字列の似ている度合い（レーベンシュタイン距離）を計算
export function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + 1
                );
            }
        }
    }
    return dp[m][n];
}

// マスター辞書との高度な照合関数（完全一致優先＆プラス記号・数値保護）
export function getBestMatchingAbility(rawText) {
    if (!rawText) return null;

    // 全角の「＋」を半角の「+」に変換し、不要なスペース等を除去
    let cleanText = rawText.replace(/＋/g, '+').replace(/[\s\t\n|:._\-「」,、]/g, '');
    if (cleanText.length === 0) return null;

    // 1. 完全一致するものがマスターに存在すれば、即座にそれを採用（最優先）
    if (MASTER_ABILITIES.includes(cleanText)) {
        return cleanText;
    }

    // 近・中・遠距離戦闘強化の強制補正判定
    if (cleanText.includes('近') && (cleanText.includes('強化') || cleanText.includes('戦') || cleanText.includes('離'))) {
        return '近距離戦闘強化';
    }
    if (cleanText.includes('中') && (cleanText.includes('強化') || cleanText.includes('戦') || cleanText.includes('離'))) {
        return '中距離戦闘強化';
    }
    if (cleanText.includes('遠') && (cleanText.includes('強化') || cleanText.includes('戦') || cleanText.includes('離'))) {
        return '遠距離戦闘強化';
    }

    // 移動力+10 / +15 の誤認保護判定
    if (cleanText.includes('移動') || cleanText.includes('動')) {
        if (cleanText.includes('15') || cleanText.includes('5')) return '移動力+15';
        if (cleanText.includes('10') || cleanText.includes('0')) return '移動力+10';
    }

    // 2. あいまい補正（類似度判定）
    let bestMatch = null;
    let lowestDistance = Infinity;

    for (const master of MASTER_ABILITIES) {
        const dist = levenshteinDistance(cleanText, master);
        
        let maxAllowedDist = 1;
        if (master.length >= 4) {
            maxAllowedDist = 2;
        }
        if (master.length >= 8) {
            maxAllowedDist = 3;
        }

        if (dist < lowestDistance && dist <= maxAllowedDist) {
            lowestDistance = dist;
            bestMatch = master;
        }
    }

    return bestMatch;
}

// 画像の最下部（特殊能力エリア）の範囲切り出し＆二値化処理
export function cropAbilityRegion(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const cropHeight = Math.floor(img.height * 0.22);
            const cropY = img.height - cropHeight;
            const cropWidth = Math.floor(img.width * 0.40);

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            ctx.drawImage(img, 0, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const bw = luminance > 110 ? 255 : 0;
                data[i] = bw;
                data[i + 1] = bw;
                data[i + 2] = bw;
            }
            ctx.putImageData(imageData, 0, 0);

            canvas.toBlob((blob) => {
                resolve(blob);
            });
        };
        img.src = URL.createObjectURL(file);
    });
}

// 特殊能力自動解析メイン関数
export async function analyzeImageAbilities(file) {
    try {
        const croppedBlob = await cropAbilityRegion(file);

        const result = await Tesseract.recognize(croppedBlob, 'jpn');
        const rawText = result.data.text;
        const lines = rawText.split(/\r?\n/);

        const detectedItems = [];

        for (let line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // NGキーワードの判定
            const isNG = NG_KEYWORDS.some(keyword => trimmedLine.includes(keyword));
            if (isNG || trimmedLine.length < 2) {
                continue;
            }

            // 行頭の「No.1」などのナンバリングのみをピンポイントで除去（+記号や能力数値は残す）
            let cleanLine = trimmedLine.replace(/^No\s*[\.\s\d:]*/i, '').trim();
            // 枠線や鉤括弧などのノイズ記号のみ除去（「+」は絶対保持）
            cleanLine = cleanLine.replace(/[|│┃_\]\[\}\{`’'":;・.（）()「」、,]/g, '').trim();

            if (!cleanLine) continue;

            if (NG_KEYWORDS.some(keyword => cleanLine.includes(keyword))) {
                continue;
            }

            const matchedAbility = getBestMatchingAbility(cleanLine);
            
            if (matchedAbility && !detectedItems.includes(matchedAbility)) {
                detectedItems.push(matchedAbility);
            }
        }

        return detectedItems.slice(0, 9).map((text, index) => ({
            no: index + 1,
            text: text
        }));
    } catch (err) {
        console.warn("OCR解析エラー (スルーして続行):", err);
        return [];
    }
}
