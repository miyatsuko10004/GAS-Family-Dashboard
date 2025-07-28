// MenuNotificationService.gs
// 献立通知アプリのロジックとデータ操作

/**
 * スプレッドシートから設定値を読み込む。
 * @function menu_getSettings
 * @returns {Object} 設定項目と設定値のペアを含むオブジェクト。
 */
function menu_getSettings() {
  initializeAppConfig(); // 設定を初期化
  try {
    const ss = getMenuSpreadsheet();
    const sheet = ss.getSheetByName("設定");
    if (!sheet) {
      throw new Error("「設定」シートが見つかりません。");
    }
    const data = sheet.getDataRange().getValues();
    const settings = {};
    for (let i = 0; i < data.length; i++) {
      settings[data[i][0]] = data[i][1];
    }
    return settings;
  } catch (e) {
    handleError('menu_getSettings', e);
  }
}

/**
 * スプレッドシートから食材リストを読み込む。
 * @function menu_getIngredients
 * @returns {Array<Object>} 各食材の情報をオブジェクトとして含む配列。
 */
function menu_getIngredients() {
  initializeAppConfig(); // 設定を初期化
  try {
    const ss = getMenuSpreadsheet();
    const sheet = ss.getSheetByName("食材リスト");
    if (!sheet) {
      throw new Error("「食材リスト」シートが見つかりません。");
    }
    const data = sheet.getDataRange().getValues();
    if (data.length < 1) return []; // ヘッダー行のみの場合
    const headers = data[0]; // ヘッダー行を取得
    const ingredients = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const ingredient = {};
      for (let j = 0; j < headers.length; j++) {
        ingredient[headers[j]] = row[j];
      }
      ingredients.push(ingredient);
    }
    return ingredients;
  } catch (e) {
    handleError('menu_getIngredients', e);
  }
}

/**
 * スプレッドシートから調味料リストを読み込む。
 * @function menu_getSeasonings
 * @returns {Array<string>} 調味料名の配列。
 */
function menu_getSeasonings() {
  initializeAppConfig(); // 設定を初期化
  try {
    const ss = getMenuSpreadsheet();
    const sheet = ss.getSheetByName("調味料リスト");
    if (!sheet) {
      throw new Error("「調味料リスト」シートが見つかりません。");
    }
    const data = sheet.getRange("A2:A").getValues(); // A列のみ取得
    return data.flat().filter(String); // 空白セルを除外して1次元配列に
  } catch (e) {
    handleError('menu_getSeasonings', e);
  }
}

/**
 * ★新規追加: 献立履歴シートから指定された日数以内の献立名を取得する。
 * @param {number} days 遡る日数
 * @returns {Array<string>} 指定された日数以内に提案された献立名の配列。
 */
function menu_getRecentMenuHistory(days) {
  initializeAppConfig();
  try {
    const ss = getMenuSpreadsheet();
    const sheet = ss.getSheetByName("献立履歴");
    if (!sheet) {
      myLogger("警告: 「献立履歴」シートが見つかりません。履歴は考慮されません。");
      return [];
    }
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) { // ヘッダー行のみの場合
        return [];
    }

    const recentMenus = [];
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() - days);

    // ヘッダーをスキップしてループ
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const suggestionDate = new Date(row[0]); // A列: 提案日
      const menuName = row[1]; // B列: メニュー名

      if (suggestionDate >= thresholdDate && menuName) {
        recentMenus.push(menuName);
      }
    }
    myLogger(`${days}日以内の履歴: ${recentMenus.join(', ')}`);
    return recentMenus;
  } catch (e) {
    handleError('menu_getRecentMenuHistory', e);
    return []; // エラーが発生した場合は空の配列を返す
  }
}


/**
 * Gemini APIに献立提案をリクエストし、結果をパースする。
 * @function menu_callGeminiApiForMenu
 * @param {Array<Object>} ingredients - 利用可能な食材リスト。
 * @param {Array<string>} seasonings - 利用可能な調味料リスト。
 * @param {Object} settings - ユーザー設定。
 * @param {Array<string>} recentMenus - ★修正: 最近提案されたメニューのリスト。
 * @returns {string} Geminiからの提案テキスト。
 */
function menu_callGeminiApiForMenu(ingredients, seasonings, settings, recentMenus) { // ★修正: recentMenus を引数に追加
  initializeAppConfig(); // 設定を初期化
  const MODEL_NAME = "gemini-1.5-flash"; 
  const eatingPeople = settings['食べる人数'] || 1; // デフォルト1人
  const numSuggestions = settings['献立提案数'] || 1; // デフォルト1品に設定
  const GEMINI_API_KEY = getGeminiApiKey();

  // ★修正: 食材リストをシャッフルして、優先順位の影響をランダム化する
  for (let i = ingredients.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ingredients[i], ingredients[j]] = [ingredients[j], ingredients[i]];
  }

  const availableIngredientsList = ingredients.map(i => {
    let desc = i['食材名'];
    if (i['数量']) desc += `(${i['数量']})`;
    if (i['消費期限'] && typeof i['消費期限'].getMonth === 'function') {
      const today = new Date();
      // ★修正: 期限切れと期限間近の計算をより正確に
      const diffTime = i['消費期限'].getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 3 && diffDays >= 0) {
        desc += `(期限${diffDays}日以内)`;
      } else if (diffDays < 0) {
        desc += `(期限切れ)`;
      }
    }
    return desc;
  }).join(', ');

  const priorityIngredients = ingredients
    .filter(item => item['優先消費'] === true)
    .map(item => item['食材名'])
    .join(', ');

  let prompt = `あなたは料理の専門家です。以下の食材と調味料を使って、${eatingPeople}人前の、簡単に作れる夜ご飯のメニューを${numSuggestions}つ提案してください。`;

  if (priorityIngredients) {
    prompt += `\n特に、以下の食材を優先的に消費できるような献立を提案してください: ${priorityIngredients}。`;
  }

  // ★修正: 履歴にあるメニューを避けるように指示を追加
  if (recentMenus && recentMenus.length > 0) {
    prompt += `\n\n以下のメニューは過去2週間で提案済みのため、これらとは異なる新しいメニューを提案してください: ${recentMenus.join(', ')}`;
  }

  prompt += `
  辛いもの、ネギ、たまねぎ、ニンニクは**絶対に使用しないでください**。これらの食材を含む献立は提案しないでください。

  各メニューについて、以下の形式で簡潔に回答してください。箇条書きは使わず、各項目を改行で区切ってください。

  メニュー名: [メニュー名]
  主要食材: [使用する主な食材をカンマ区切りで記載]
  調理時間: [例: 30分]
  簡単な調理手順: [具体的な調理手順を簡潔に。例: 1. 材料を切る。2. 炒める。3. 味付けする。]

  利用可能な食材: ${availableIngredientsList}
  利用可能な調味料: ${seasonings.join(', ')}
  `;

  myLogger("Geminiへのプロンプト:\n" + prompt);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  const options = {
    "method" : "post",
    "headers" : { "Content-Type" : "application/json" },
    "payload" : JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const jsonResponse = JSON.parse(response.getContentText());
    
    if (jsonResponse.candidates && jsonResponse.candidates.length > 0 && jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts && jsonResponse.candidates[0].content.parts.length > 0) {
      const geminiOutput = jsonResponse.candidates[0].content.parts[0].text;
      myLogger("Geminiからの提案生テキスト:\n" + geminiOutput);
      return geminiOutput;
    } else {
      myLogger("Geminiからの応答に有効な内容がありません: " + JSON.stringify(jsonResponse));
      throw new Error("Geminiから有効な献立提案が得られませんでした。");
    }
  } catch (e) {
    handleError('menu_callGeminiApiForMenu', e);
  }
}

/**
 * 提案された献立情報からGoogle検索用のURLを生成する。
 * @function menu_generateRecipeSearchUrl
 * @param {string} menuName - メニュー名。
 * @returns {string} Google検索URL。
 */
function menu_generateRecipeSearchUrl(menuName) {
  return `https://www.google.com/search?q=${encodeURIComponent(menuName + " レシピ")}`;
}

/**
 * Geminiの応答テキストをパースしてオブジェクトに変換するヘルパー関数。
 * @function menu_parseGeminiResponse
 * @param {string} responseText - Geminiからの生の応答テキスト。
 * @returns {Object} パースされた献立情報。
 */
function menu_parseGeminiResponse(responseText) {
  const result = {
    menuName: '',
    mainIngredients: '',
    cookingTime: '',
    cookingSteps: ''
  };
  
  const lines = responseText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    if (line.startsWith('メニュー名:')) {
      result.menuName = line.replace('メニュー名:', '').trim();
    } else if (line.startsWith('主要食材:')) {
      result.mainIngredients = line.replace('主要食材:', '').trim();
    } else if (line.startsWith('調理時間:')) {
      result.cookingTime = line.replace('調理時間:', '').trim();
    } else if (line.startsWith('簡単な調理手順:')) {
      result.cookingSteps = line.replace('簡単な調理手順:', '').trim();
    }
  }
  return result;
}

/**
 * 献立履歴シートに提案内容を記録する。
 * @function menu_recordMenuHistory
 * @param {string} rawGeminiText - Geminiから提案された元のテキスト。
 * @param {string} recipeUrl - 生成されたレシピURL。
 */
function menu_recordMenuHistory(rawGeminiText, recipeUrl) {
  initializeAppConfig();
  try {
    const ss = getMenuSpreadsheet();
    const sheet = ss.getSheetByName("献立履歴");
    if (!sheet) {
      myLogger("エラー: 「献立履歴」シートが見つかりません。履歴は記録されませんでした。");
      return;
    }

    const today = new Date();
    const parsed = menu_parseGeminiResponse(rawGeminiText);

    sheet.appendRow([
      today,
      parsed.menuName,
      parsed.mainIngredients,
      parsed.cookingTime,
      parsed.cookingSteps,
      recipeUrl,
      ""
    ]);
    myLogger("献立履歴を記録しました。");
  } catch (e) {
    handleError('menu_recordMenuHistory', e);
  }
}

/**
 * 献立提案と通知のメイン処理。毎日実行される。
 * @function suggestAndNotifyMenu
 */
function suggestAndNotifyMenu() {
  initializeAppConfig();

  try {
    const settings = menu_getSettings();
    const ingredients = menu_getIngredients();
    const seasonings = menu_getSeasonings();
    // ★修正: 過去14日間の履歴を取得
    const recentMenus = menu_getRecentMenuHistory(14); 

    // ★修正: 履歴を渡してGeminiに問い合わせ
    const geminiResponseText = menu_callGeminiApiForMenu(ingredients, seasonings, settings, recentMenus);
    
    const parsedMenu = menu_parseGeminiResponse(geminiResponseText);
    const recipeUrl = menu_generateRecipeSearchUrl(parsedMenu.menuName);

    const lineMessage = `今日の献立提案です！\n\n` +
                      `メニュー名: ${parsedMenu.menuName}\n` +
                      `主要食材: ${parsedMenu.mainIngredients}\n` +
                      `調理時間: ${parsedMenu.cookingTime}\n` +
                      `簡単な調理手順: ${parsedMenu.cookingSteps}\n\n` +
                      `レシピを検索: ${recipeUrl}`;
    
    sendLineMessage(lineMessage);
    menu_recordMenuHistory(geminiResponseText, recipeUrl);

  } catch (e) {
    handleError('suggestAndNotifyMenu', e, true);
  }
}

/**
 * 買い物リストを生成し、LINEに通知するメイン処理。週次で実行される。
 * @function generateAndNotifyShoppingList
 */
function generateAndNotifyShoppingList() {
  initializeAppConfig();

  try {
    const settings = menu_getSettings();
    const ingredients = menu_getIngredients();
    const GEMINI_API_KEY = getGeminiApiKey();

    const prompt = `あなたは買い物リスト作成の専門家です。以下の食材が冷蔵庫にあります。\n${ingredients.map(i => i['食材名']).join(', ')}\n
    これらを考慮して、一般的な家庭で1週間分の献立をまかなうために、他にどんな食材や調味料が必要か、買い物リストを提案してください。
    カテゴリごとにまとめて、簡潔にリストアップしてください。`;

    const MODEL_NAME = "gemini-1.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    const options = {
      "method": "post",
      "headers": { "Content-Type": "application/json" },
      "payload": JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    };

    const response = UrlFetchApp.fetch(url, options);
    const jsonResponse = JSON.parse(response.getContentText());
    
    if (jsonResponse.candidates && jsonResponse.candidates.length > 0 && jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts && jsonResponse.candidates[0].content.parts.length > 0) {
      const shoppingListText = jsonResponse.candidates[0].content.parts[0].text;
      const lineMessage = `今週の買い物リストです！\n\n` + shoppingListText;
      sendLineMessage(lineMessage);
      myLogger("買い物リストをLINEに通知しました。");
    } else {
      myLogger("Geminiから有効な買い物リストが得られませんでした: " + JSON.stringify(jsonResponse));
      throw new Error("Geminiから有効な買い物リストが得られませんでした。");
    }

  } catch (e) {
    handleError('generateAndNotifyShoppingList', e, true);
  }
}