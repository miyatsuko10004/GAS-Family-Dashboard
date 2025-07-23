// NotificationService.gs
// 通知関連のサービス関数 - LINE Messaging API対応版

/**
 * LINE Messaging APIを通じてメッセージを送信する。
 * @function sendLineMessage
 * @param {string} message - 送信するメッセージ。
 */
function sendLineMessage(message) {
  initializeAppConfig(); // 設定を初期化

  const CHANNEL_ACCESS_TOKEN = getLineChannelAccessToken();
  const PUSH_TARGET_ID = getLinePushTargetId();

  if (!CHANNEL_ACCESS_TOKEN || !PUSH_TARGET_ID) {
      Logger.log("エラー: LINE Messaging APIの設定が不足しています。");
      throw new Error("LINE Messaging APIの設定が不足しています。スクリプトプロパティを確認してください。");
  }

  const url = "https://api.line.me/v2/bot/message/push";
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${CHANNEL_ACCESS_TOKEN}`
  };
  const payload = JSON.stringify({
    to: PUSH_TARGET_ID,
    messages: [
      {
        type: "text",
        text: message
      }
    ]
  });

  const options = {
    method: "post",
    headers: headers,
    payload: payload,
    muteHttpExceptions: true // エラー時も例外を投げずにレスポンスを取得
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      Logger.log("LINEメッセージ送信成功: " + responseBody);
    } else {
      Logger.log(`LINEメッセージ送信失敗 (コード: ${responseCode}): ${responseBody}`);
      throw new Error(`LINEメッセージ送信失敗: ${responseBody}`);
    }
  } catch (e) {
    Logger.log("LINEメッセージ送信中にエラーが発生しました: " + e.message);
    throw e; // エラーを再スロー
  }
}
