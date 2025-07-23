
/**
 * Gemini APIへの接続テストを行う関数。
 * myLogger() を使用し、UIアラートはコンテキストが利用可能な場合のみ表示する。
 */
function testGeminiApiConnectionWithMyLogger() {
    initializeAppConfig(); // 設定を初期化

  const API_KEY = getGeminiApiKey(); 

  if (!API_KEY) {
    myLogger("◆テスト失敗◆: Gemini APIキーが取得できませんでした。getGeminiApiKey() の実装を確認してください。");
    // UIが利用可能な場合にのみアラートを表示
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Gemini APIテスト失敗！', 'APIキーが取得できませんでした。', SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return false;
  }

  // 使用するGeminiモデル名
  // クォータ超過を避けるため、gemini-1.5-flashを推奨します。
  const MODEL_NAME = "gemini-1.5-flash"; 

  // APIのエンドポイントURL
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  // 送信するプロンプト
  const prompt = "こんにちは！";

  // リクエストボディ
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  // HTTPリクエストのオプション
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true // エラー時に例外を発生させず、レスポンスを取得
  };

  try {
    myLogger("Gemini APIへのリクエストを送信中...");
    myLogger(`エンドポイント: ${endpoint}`);
    myLogger(`モデル名: ${MODEL_NAME}`);
    myLogger(`プロンプト: ${prompt}`);

    // APIにリクエストを送信
    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    myLogger(`レスポンスコード: ${responseCode}`);
    myLogger(`レスポンス本文: ${responseText}`);

    if (responseCode === 200) {
      const jsonResponse = JSON.parse(responseText);
      // 応答からテキスト部分を抽出
      const generatedText = jsonResponse.candidates[0].content.parts[0].text;
      myLogger(`★テスト成功★: Geminiからの応答 - ${generatedText}`);
      // UIが利用可能な場合にのみアラートを表示
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet && SpreadsheetApp.getUi) {
        SpreadsheetApp.getUi().alert('Gemini APIテスト成功！', `応答: ${generatedText}`, SpreadsheetApp.getUi().ButtonSet.OK);
      }
      return true;
    } else {
      myLogger(`◆テスト失敗◆: エラーが発生しました。`);
      myLogger(`エラー詳細: ${responseText}`);
      // UIが利用可能な場合にのみアラートを表示
      if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet && SpreadsheetApp.getUi) {
        SpreadsheetApp.getUi().alert('Gemini APIテスト失敗！', `エラーコード: ${responseCode}\n詳細: ${responseText}`, SpreadsheetApp.getUi().ButtonSet.OK);
      }
      return false;
    }
  } catch (e) {
    myLogger(`◆テスト失敗◆: 例外が発生しました - ${e.message}`);
    // UIが利用可能な場合にのみアラートを表示
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Gemini APIテスト失敗！', `例外が発生しました: ${e.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return false;
  }
}