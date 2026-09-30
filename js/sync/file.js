// ファイルの書き出し・読み込みを担当するファイル
// インターネットには一切通信しない。ブラウザの「保存」「ファイルを選ぶ」機能だけを使う。
(function () {
  'use strict';
  const K = window.Kakeibo;

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  }

  // JSONファイルとして保存する
  // 戻り値：'saved'（保存先を選んで保存）/ 'shared'（共有メニューから保存）/ 'downloaded'（ダウンロード）/ 'cancelled'
  async function saveJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });

    // Chrome：保存先（Google Drive のフォルダなど）を選んで、同じファイルに上書きできる
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: '家計簿データ', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return 'saved';
      } catch (err) {
        if (err.name === 'AbortError') return 'cancelled';
        console.warn(err); // うまくいかなければ、下のダウンロードに切り替える
      }
    }

    // iPhone：共有メニューの「"ファイル"に保存」から Google Drive を選べる
    if (isIOS() && typeof navigator.canShare === 'function') {
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return 'shared';
        } catch (err) {
          if (err.name === 'AbortError') return 'cancelled';
          console.warn(err);
        }
      }
    }

    // Safari（Mac）など：ブラウザのダウンロード機能で保存する
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  }

  // 選ばれたファイルを文字として読み込む
  async function readText(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('ファイルが大きすぎます。家計簿のファイルか確認してください。');
    }
    return file.text();
  }

  K.sync = K.sync || {};
  Object.assign(K.sync, { saveJson, readText });
})();
