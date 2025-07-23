// Code.gs
// メインのエントリポイントと共通ユーティリティ関数

/**
 * Webアプリケーションとしてアクセスされたときに実行される関数。
 * @param {GoogleAppsScript.Events.DoGet} e - イベントオブジェクト
 * @returns {GoogleAppsScript.HTML.HtmlOutput} HTMLコンテンツ
 */
function doGet(e) {
  initializeAppConfig(); // 全体設定を初期化

  // DashboardUI.html ファイルを返すように修正
  return HtmlService.createTemplateFromFile('DashboardUI')
      .evaluate()
      .setTitle('家庭アプリダッシュボード')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 共通のエラーハンドリングとログ出力関数。
 * @param {string} functionName - エラーが発生した関数名。
 * @param {Error} error - エラーオブジェクト。
 * @param {boolean} notifyLine - LINEに通知するかどうか。
 */
function handleError(functionName, error, notifyLine = false) {
    const errorMessage = `エラー発生: ${functionName} - ${error.message}`;
    Logger.log(errorMessage);
    if (notifyLine) {
        // sendLineNotify は NotificationService.gs に実装されている想定
        try {
            sendLineNotify(`[エラー通知] ${functionName}で問題が発生しました。\n${error.message}`);
        } catch (notifyError) {
            Logger.log(`LINE通知エラーハンドリング中にエラー: ${notifyError.message}`);
        }
    }
    throw new Error(errorMessage); // クライアントサイドにエラーを返す場合
}