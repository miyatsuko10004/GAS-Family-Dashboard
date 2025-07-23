// NotificationService.gs
// 通知関連のサービス関数

/**
 * LINE Notifyにメッセージを送信する。
 * @function sendLineNotify
 * @param {string} message - 送信するメッセージ。
 */
function sendLineNotify(message) {
  initializeAppConfig(); // 設定を初期化
  const LINE_NOTIFY_TOKEN = getLineNotifyToken();
  const options = {
    "method" : "post",
    "headers" : {
      "Authorization" : "Bearer " + LINE_NOTIFY_TOKEN
    },
    "payload" : {
      "message" : message
    }
  };

  try {
    UrlFetchApp.fetch("https://notify-api.line.me/api/notify", options);
    Logger.log("LINEに通知を送信しました。");
  } catch (e) {
    // エラーハンドラー自体からエラーを投げると無限ループになる可能性があるので注意
    Logger.log(`LINE通知の送信に失敗しました（内部エラー）: ${e.message}`);
    // ここでは handleError を直接呼ばず、ログに記録するに留めるか、より上位で捕捉する
  }
}
