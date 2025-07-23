// AppConfig.gs
// 各スプレッドシートのIDとAPIキー、LINE Messaging APIトークンを管理するファイル

// スクリプトプロパティから読み込むためのグローバル変数
let SPREADSHEET_ID_APP_CONFIG;
let SPREADSHEET_ID_KAKEIBO;
let SPREADSHEET_ID_MENU;
let SPREADSHEET_ID_HUNDRED_LIST;
let SPREADSHEET_ID_SCRIPT_LOGS; // ★追加: ログ用スプレッドシートID
let GEMINI_API_KEY;
let LINE_CHANNEL_ACCESS_TOKEN;
let LINE_PUSH_TARGET_ID;

/**
 * アプリケーションの初期設定を実行する関数。スクリプトプロパティの読み込みなど。
 * この関数は、各機能の実行前に必ず呼び出すようにしてください。
 * @function initializeAppConfig
 */
function initializeAppConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  SPREADSHEET_ID_APP_CONFIG = scriptProperties.getProperty('SPREADSHEET_ID_APP_CONFIG');
  SPREADSHEET_ID_KAKEIBO = scriptProperties.getProperty('SPREADSHEET_ID_KAKEIBO');
  SPREADSHEET_ID_MENU = scriptProperties.getProperty('SPREADSHEET_ID_MENU');
  SPREADSHEET_ID_HUNDRED_LIST = scriptProperties.getProperty('SPREADSHEET_ID_HUNDRED_LIST');
  SPREADSHEET_ID_SCRIPT_LOGS = scriptProperties.getProperty('SPREADSHEET_ID_SCRIPT_LOGS'); // ★追加
  GEMINI_API_KEY = scriptProperties.getProperty('GEMINI_API_KEY');
  LINE_CHANNEL_ACCESS_TOKEN = scriptProperties.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  LINE_PUSH_TARGET_ID = scriptProperties.getProperty('LINE_PUSH_TARGET_ID');

  if (!SPREADSHEET_ID_APP_CONFIG || !SPREADSHEET_ID_KAKEIBO || !SPREADSHEET_ID_MENU || !SPREADSHEET_ID_HUNDRED_LIST || !SPREADSHEET_ID_SCRIPT_LOGS || !GEMINI_API_KEY || !LINE_CHANNEL_ACCESS_TOKEN || !LINE_PUSH_TARGET_ID) {
    myLogger("エラー: スプレッドシートID、APIキー、またはLINE Messaging API設定（チャネルアクセストークン、プッシュ先ID）が不足しています。");
    throw new Error("設定情報が不足しています。GASのスクリプトプロパティを確認してください。");
  }
}

// 各スプレッドシートへのアクセス関数
function getAppConfigSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID_APP_CONFIG);
}

function getKakeiboSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID_KAKEIBO);
}

function getMenuSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID_MENU);
}

function getHundredListSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID_HUNDRED_LIST);
}

function getScriptLogsSpreadsheet() { // ★追加: ログ用スプレッドシート取得関数
  return SpreadsheetApp.openById(SPREADSHEET_ID_SCRIPT_LOGS);
}

// APIキー取得関数
function getGeminiApiKey() {
    return GEMINI_API_KEY;
}

// LINE Messaging APIのトークンとID取得関数
function getLineChannelAccessToken() {
    return LINE_CHANNEL_ACCESS_TOKEN;
}

function getLinePushTargetId() {
    return LINE_PUSH_TARGET_ID;
}

/**
 * カスタムロギング関数。標準ログとスプレッドシートに書き込む。
 * @param {string} message - ログメッセージ。
 * @param {string} level - ログレベル (例: 'INFO', 'WARN', 'ERROR')。デフォルトは 'INFO'。
 */
function myLogger(message, level = 'INFO') {
  // 標準のLoggerにも出力
  Logger.log(`[${level}] ${message}`);

  try {
    initializeAppConfig(); // 設定が読み込まれていない可能性があるので、念のため呼び出し
    const ss = getScriptLogsSpreadsheet();
    const sheet = ss.getActiveSheet(); // アクティブシートに書き込む
    
    // タイムスタンプ、ログレベル、メッセージを書き込む
    sheet.appendRow([new Date(), level, message]);
  } catch (e) {
    // スプレッドシートへのログ書き込み自体が失敗した場合
    Logger.log(`FATAL ERROR: Failed to write log to spreadsheet: ${e.message} - Original log: ${message}`);
  }
}

/**
 * エラーハンドリング関数。エラーをログに記録し、必要に応じてLINEに通知する。
 * @param {string} functionName - エラーが発生した関数名。
 * @param {Error} error - 発生したエラーオブジェクト。
 * @param {boolean} [notifyLine=false] - LINEにエラー通知を送るか。
 */
function handleError(functionName, error, notifyLine = false) {
  const errorMessage = `関数「${functionName}」でエラーが発生しました: ${error.message}`;
  myLogger(errorMessage, 'ERROR'); // カスタムロガーを使用

  if (notifyLine) {
    try {
      sendLineMessage(`エラー通知: ${errorMessage}`);
    } catch (lineError) {
      myLogger(`LINEエラー通知の送信に失敗しました: ${lineError.message}`, 'ERROR');
    }
  }
  throw error; // エラーを再スローして実行を停止させる
}