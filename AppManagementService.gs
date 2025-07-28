// AppManagementService.gs
// アプリ管理機能（ダッシュボードに表示するアプリのCRUD操作）

/**
 * ダッシュボードに表示するアプリ情報をすべて取得する。
 * @returns {Array<Object>} アプリ情報の配列
 */
function app_getAllApps() {
  initializeAppConfig();
  try {
    // const ss = getAppConfigSpreadsheet();
    // const sheet = ss.getSheetByName("Apps");
    // if (!sheet) throw new Error("「Apps」シートが見つかりません。");

    // const data = sheet.getDataRange().getValues();
    // if (data.length < 2) return []; // ヘッダーのみの場合

    // const headers = data[0];
    // const apps = [];
    // for (let i = 1; i < data.length; i++) {
    //   const row = data[i];
    //   const app = {};
    //   for (let j = 0; j < headers.length; j++) {
    //     app[headers[j]] = row[j];
    //   }
    //   apps.push(app);
    // }
    // myLogger(`アプリ情報が ${apps.length} 件取得されました。`);
    // return apps;
    myLogger('テスト：シンプルな文字列を返します');
    return "TEST_SUCCESS_DATA";
  } catch (e) {
    handleError('app_getAllApps', e);
    return null;
  }
}

/**
 * 新しいアプリ情報を追加する。
 * @param {Object} appData - 追加するアプリのデータ (アプリ名, 説明, URLなど)
 * @returns {Object} 追加されたアプリのデータ
 */
function app_addApp(appData) {
  initializeAppConfig();
  try {
    const ss = getAppConfigSpreadsheet();
    const sheet = ss.getSheetByName("Apps");
    if (!sheet) throw new Error("「Apps」シートが見つかりません。");

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = [];
    
    // アプリIDをシンプルにタイムスタンプで生成
    appData.アプリID = `app_${Date.now()}`;
    appData.登録日時 = new Date();
    appData.最終更新日時 = new Date();

    for (const header of headers) {
      newRow.push(appData[header] || ''); // 該当するプロパティがなければ空文字列
    }
    sheet.appendRow(newRow);
    myLogger(`アプリを追加しました: ${appData.アプリ名}`);
    return appData;
  } catch (e) {
    handleError('app_addApp', e, true); // エラー時LINE通知
  }
}

/**
 * 既存のアプリ情報を更新する。
 * @param {Object} appData - 更新するアプリのデータ (アプリID必須)
 * @returns {Object} 更新されたアプリのデータ
 */
function app_updateApp(appData) {
  initializeAppConfig();
  try {
    const ss = getAppConfigSpreadsheet();
    const sheet = ss.getSheetByName("Apps");
    if (!sheet) throw new Error("「Apps」シートが見つかりません。");

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) throw new Error("更新するアプリが見つかりません。");

    const headers = data[0];
    let updated = false;

    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('アプリID')] === appData.アプリID) {
        const row = data[i];
        appData.最終更新日時 = new Date(); // 更新日時を最新に

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          if (appData.hasOwnProperty(header)) {
            row[j] = appData[header];
          }
        }
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        myLogger(`アプリを更新しました: ${appData.アプリ名}`);
        updated = true;
        break;
      }
    }
    if (!updated) throw new Error(`アプリID ${appData.アプリID} のアプリが見つかりませんでした。`);
    return appData;
  } catch (e) {
    handleError('app_updateApp', e, true);
  }
}

/**
 * アプリ情報を削除する。
 * @param {string} appId - 削除するアプリのID
 * @returns {boolean} 削除が成功したかどうか
 */
function app_deleteApp(appId) {
  initializeAppConfig();
  try {
    const ss = getAppConfigSpreadsheet();
    const sheet = ss.getSheetByName("Apps");
    if (!sheet) throw new Error("「Apps」シートが見つかりません。");

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) throw new Error("削除するアプリが見つかりません。");

    const headers = data[0];
    let deleted = false;

    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('アプリID')] === appId) {
        sheet.deleteRow(i + 1);
        myLogger(`アプリID ${appId} を削除しました。`);
        deleted = true;
        break;
      }
    }
    if (!deleted) throw new Error(`アプリID ${appId} のアプリが見つかりませんでした。`);
    return true;
  } catch (e) {
    handleError('app_deleteApp', e, true);
  }
}
