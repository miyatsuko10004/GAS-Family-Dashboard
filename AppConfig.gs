// AppConfig.gs
// 各スプレッドシートのIDとAPIキー、LINE Notifyトークンを管理するファイル

// スクリプトプロパティから読み込むためのグローバル変数
let SPREADSHEET_ID_APP_CONFIG;
let SPREADSHEET_ID_KAKEIBO;
let SPREADSHEET_ID_MENU;
let SPREADSHEET_ID_HUNDRED_LIST;
let GEMINI_API_KEY;
let LINE_NOTIFY_TOKEN;

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
  GEMINI_API_KEY = scriptProperties.getProperty('GEMINI_API_KEY');
  LINE_NOTIFY_TOKEN = scriptProperties.getProperty('LINE_NOTIFY_TOKEN');

  if (!SPREADSHEET_ID_APP_CONFIG || !SPREADSHEET_ID_KAKEIBO || !SPREADSHEET_ID_MENU || !SPREADSHEET_ID_HUNDRED_LIST || !GEMINI_API_KEY || !LINE_NOTIFY_TOKEN) {
    Logger.log("エラー: スプレッドシートIDまたはAPIキー、LINE Notifyトークンが設定されていません。");
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

// APIキー取得関数
function getGeminiApiKey() {
    return GEMINI_API_KEY;
}

function getLineNotifyToken() {
    return LINE_NOTIFY_TOKEN;
}