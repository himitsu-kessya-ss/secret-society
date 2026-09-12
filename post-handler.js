/**
 * post-handler.js
 * 投稿データの登録、削除、ImgBB画像アップロード等のロジック
 */

import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { analyzeImageAbilities } from "./ocr-processor.js";

const IMGBB_API_KEY = "29969679b0297f97687888bd7faede64";
const ADMIN_PASS = "p@ssw0rd";

/**
 * 画像をImgBBにアップロードする処理
 */
export async function uploadImageToImgBB(file, newPostNo, unitNumber, unitName) {
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const newFileName = `PostNo${newPostNo}_${unitNumber}_${unitName}${fileExtension}`;
    const renamedFile = new File([file], newFileName, { type: file.type });

    const formData = new FormData();
    formData.append("image", renamedFile);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
    });

    const result = await response.json();
    if (!result.success) {
        throw new Error("画像のアップロードに失敗しました。");
    }

    return result.data.url;
}

/**
 * 新規投稿メイン処理
 */
export async function handlePostSubmit({ db, file, unitNumber, unitName, author, deleteKey, submitBtn }) {
    if (!file) {
        alert('画像を選択してください。');
        return false;
    }

    if (!/^\d{4}$/.test(deleteKey)) {
        alert('削除キーは数字4桁で設定してください。');
        return false;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '画像解析中... (数秒かかります)';

    try {
        // 1. OCRで特殊能力を自動解析
        const abilities = await analyzeImageAbilities(file);

        submitBtn.textContent = 'アップロード中...';

        // 2. 投稿No.のオートインクリメント計算
        const snapshot = await getDocs(collection(db, "posts"));
        let maxNo = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.postNo && typeof data.postNo === 'number') {
                if (data.postNo > maxNo) {
                    maxNo = data.postNo;
                }
            }
        });
        const newPostNo = maxNo + 1;

        // 3. ImgBBへの画像アップロード
        const imageUrl = await uploadImageToImgBB(file, newPostNo, unitNumber, unitName);

        // 4. Firebaseへの保存
        await addDoc(collection(db, "posts"), {
            postNo: newPostNo,
            unitNumber: unitNumber,
            unitName: unitName,
            author: author,
            deleteKey: deleteKey,
            imageUrl: imageUrl,
            abilities: abilities,
            createdAt: serverTimestamp()
        });

        alert(`投稿が完了しました！（投稿 No.${newPostNo}）`);
        return true;

    } catch (error) {
        console.error("投稿エラー:", error);
        alert('投稿に失敗しました：' + error.message);
        return false;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '投稿する';
    }
}

/**
 * 投稿削除処理
 */
export async function handlePostDelete(db, docId, savedKey, onSuccess) {
    const inputKey = prompt('削除キーを入力してください：');
    if (inputKey === null) return;

    const trimmedKey = inputKey.trim();

    // 管理者パスワードによる強制削除
    if (trimmedKey === ADMIN_PASS) {
        try {
            await deleteDoc(doc(db, "posts", docId));
            alert('【管理者権限】投稿を削除しました。');
            if (onSuccess) onSuccess();
            return;
        } catch (error) {
            console.error("削除エラー:", error);
            alert('削除処理に失敗しました：' + error.message);
            return;
        }
    }

    if (!/^\d{4}$/.test(trimmedKey)) {
        alert('投稿者用の削除キーは数字4桁で入力してください。');
        return;
    }

    if (trimmedKey === savedKey) {
        try {
            await deleteDoc(doc(db, "posts", docId));
            alert('投稿を削除しました。');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("削除エラー:", error);
            alert('削除処理に失敗しました：' + error.message);
        }
    } else {
        alert('削除キーが違います。');
    }
}
