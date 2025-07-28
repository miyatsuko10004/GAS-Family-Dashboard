// KakeiboService.gs
// 家計簿アプリのロジックとデータ操作

/**
 * @overview 家計簿アプリのサービス関数群です。
 * 既存の家計簿アプリのCode.gsのコードをこのファイルに統合し、変更を加えています。
 * - 関数名のプレフィックスを `kakeibo_` としています。
 * - スプレッドシートIDは `AppConfig.gs` の `getKakeiboSpreadsheet()` を使用しています。
 * - グローバルロックサービスは関数内で取得するように変更しています。
 * - ロギングは `myLogger()` に置き換えています。
 * - エラーハンドリングは `handleError()` を使用しています。
 */

// =================================================================
// ヘルパー関数 (シート取得、データ整形など)
// =================================================================

/**
 * 家計簿スプレッドシートから必要なシートオブジェクトを取得するヘルパー関数。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - 家計簿スプレッドシートオブジェクト
 * @returns {Object} 各シートオブジェクトを含む辞書
 */
function kakeibo_getSheetsHelper(ss) {
  const accountsSheet = ss.getSheetByName('Accounts');
  const transactionsSheet = ss.getSheetByName('Transactions');
  const templatesSheet = ss.getSheetByName('AllocationTemplates');
  const futureExpensesSheet = ss.getSheetByName('FutureExpenses');
  
  if (!accountsSheet) throw new Error("シート「Accounts」が見つかりません。");
  if (!transactionsSheet) throw new Error("シート「Transactions」が見つかりません。");
  if (!templatesSheet) throw new Error("シート「AllocationTemplates」が見つかりません。");
  if (!futureExpensesSheet) throw new Error("シート「FutureExpenses」が見つかりません。");
  
  return { ss, accountsSheet, transactionsSheet, templatesSheet, futureExpensesSheet };
}

/**
 * 指定された日付を 'YYYY-MM-DD' 形式の文字列にフォーマットする。
 * @param {Date} date - フォーマットする日付オブジェクト
 * @returns {string} フォーマットされた日付文字列
 */
function kakeibo_formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    myLogger(`不正な日付データ: ${date}`, 'WARN');
    return ''; // または適切なデフォルト値を返す
  }
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

/**
 * Accountsシートからアカウントデータを取得する。
 * @param {Object} sheets - シートオブジェクトのコンテナ
 * @returns {Array<Object>} アカウントデータの配列
 */
function kakeibo_getAccounts({ accountsSheet }) {
  const data = accountsSheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ヘッダーのみの場合
  return data.slice(1).map((row, i) => ({ 
    id: row[6] || `A-${i+1}-${Date.now()}`, // IDが空の場合に生成
    category: row[0], 
    balance: Number(row[1]) || 0,
    type: row[2],
    group: row[3],
    goal: Number(row[4]) || 0,
    isDefault: row[5] === true // チェックボックスはbooleanで取得される想定
  }));
}

/**
 * Transactionsシートからトランザクションデータを取得する。
 * @param {Object} sheets - シートオブジェクトのコンテナ
 * @param {Object} filters - フィルタリング条件
 * @returns {Array<Object>} トランザクションデータの配列
 */
function kakeibo_getTransactions({ transactionsSheet }, filters = {}) {
  const data = transactionsSheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ヘッダーのみの場合
  
  let transactions = data.slice(1).map(row => ({ 
    id: row[0], 
    date: kakeibo_formatDate(new Date(row[1])), 
    type: row[2], 
    amount: Number(row[3]) || 0, 
    category: row[4], 
    memo: row[5] 
  }));

  if (filters.startDate) transactions = transactions.filter(t => new Date(t.date) >= new Date(filters.startDate));
  if (filters.endDate) transactions = transactions.filter(t => new Date(t.date) <= new Date(filters.endDate));
  if (filters.category) transactions = transactions.filter(t => t.category === filters.category);
  if (filters.types && filters.types.length > 0) transactions = transactions.filter(t => filters.types.includes(t.type));
  if (filters.keyword) transactions = transactions.filter(t => t.memo.includes(filters.keyword));
  
  return transactions;
}

/**
 * AllocationTemplatesシートからテンプレートデータを取得する。
 * @param {Object} sheets - シートオブジェクトのコンテナ
 * @returns {Object} テンプレートデータのオブジェクト
 */
function kakeibo_getTemplates({ templatesSheet }) {
  const data = templatesSheet.getDataRange().getValues();
  if (data.length <= 1) return {}; // ヘッダーのみの場合
  return data.slice(1).reduce((map, row) => {
    const [templateName, type, category, amount, isExpense] = row;
    if (!map[templateName]) map[templateName] = { incomes: {}, allocations: {} };
    
    if (type === '収入') {
      map[templateName].incomes[category] = Number(amount) || 0;
    } else if (type === '振分') {
      map[templateName].allocations[category] = {
        amount: Number(amount) || 0,
        isExpense: isExpense === true // チェックボックスはbooleanで取得される想定
      };
    }
    return map;
  }, {});
}

/**
 * FutureExpensesシートから将来の支出データを取得する。
 * @param {Object} sheets - シートオブジェクトのコンテナ
 * @returns {Array<Object>} 将来の支出データの配列
 */
function kakeibo_getFutureExpenses({ futureExpensesSheet }) {
  const data = futureExpensesSheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ヘッダーのみの場合
  return data.slice(1).map(row => ({ 
    id: row[0], 
    name: row[1], 
    amount: Number(row[2]) || 0, 
    date: kakeibo_formatDate(new Date(row[3])), 
    sourceAccount: row[4] 
  }));
}

// =================================================================
// データ取得・更新のメイン関数
// =================================================================

/**
 * アプリの初期データを取得する。ダッシュボードに表示する主要データ。
 * @returns {Object} 初期データ構造
 */
function kakeibo_getInitialData() {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock(); // 関数内でロックを取得
  LOCK.waitLock(15000); // ロックを最大15秒待機
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    
    return {
      dashboardData: kakeibo_getDashboardData(sheets),
      templates: kakeibo_getTemplates(sheets),
      futureExpenses: kakeibo_getFutureExpenses(sheets),
      transactions: kakeibo_getTransactions(sheets)
    };
  } catch(e) {
    handleError("kakeibo_getInitialData", e, true);
    // エラーが発生した場合でも、アプリがクラッシュしないように空の構造を返す
    return {
      dashboardData: { accounts: [], toBeBudgeted: 0 },
      templates: {},
      futureExpenses: [],
      transactions: []
    };
  } finally {
    LOCK.releaseLock(); // 必ずロックを解放
  }
}

/**
 * トランザクション（支出/収入/振分）を記録する。
 * @param {Object} data - トランザクションデータ
 * @returns {Object} 更新された初期データ
 */
function kakeibo_recordTransaction(data) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const id = 'T-' + new Date().toISOString().replace(/[-:.]/g, ''); // ユニークID生成
    
    // 日付データをDateオブジェクトに変換して保存
    const transactionDate = new Date(data.date); 
    
    sheets.transactionsSheet.appendRow([id, transactionDate, data.type, data.amount, data.category, data.memo]);
    kakeibo_updateBalances(sheets);
    myLogger(`トランザクションを記録しました: ${data.item} - ${data.amount}`);
    return kakeibo_getInitialData(); // データ更新後に最新データを返す
  } catch (e) {
    handleError('kakeibo_recordTransaction', e, true);
    return kakeibo_getInitialData(); // エラー時も最新データを取得試行
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * 給与を記録する。
 * @param {Object} salaryData - 給与データ
 * @returns {Object} 更新された初期データ
 */
function kakeibo_recordSalary(salaryData) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const id = 'T-' + new Date().toISOString().replace(/[-:.]/g, '');
    
    const salaryDate = new Date(salaryData.date);

    if (salaryData.category === '夫の給料') {
      const accounts = kakeibo_getAccounts(sheets);
      const defaultAccount = accounts.find(acc => acc.isDefault);
      const targetAccount = defaultAccount ? defaultAccount.category : '2人の貯金'; // デフォルト口座がなければ「2人の貯金」

      sheets.transactionsSheet.appendRow([id + '-I', salaryDate, '収入', salaryData.amount, salaryData.category, salaryData.memo]);
      sheets.transactionsSheet.appendRow([id + '-A', salaryDate, '振分', salaryData.amount, targetAccount, '夫の給料より自動振分']);
    } else {
      sheets.transactionsSheet.appendRow([id, salaryDate, '収入', salaryData.amount, salaryData.category, salaryData.memo]);
    }
    
    kakeibo_updateBalances(sheets);
    myLogger(`給与を記録しました: ${salaryData.category} - ${salaryData.amount}円`);
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_recordSalary', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * 既存のトランザクションを更新する。
 * @param {Object} data - 更新するトランザクションデータ
 * @returns {Object} 更新された初期データ
 */
function kakeibo_updateTransaction(data) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const allData = sheets.transactionsSheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        // 日付データをDateオブジェクトに変換
        const transactionDate = new Date(data.date);
        sheets.transactionsSheet.getRange(i + 1, 2, 1, 5).setValues([[transactionDate, data.type, data.amount, data.category, data.memo]]);
        myLogger(`トランザクションを更新しました: ID ${data.id}`);
        break;
      }
    }
    kakeibo_updateBalances(sheets);
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_updateTransaction', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * トランザクションを削除する。
 * @param {string} id - 削除するトランザクションのID
 * @returns {Object} 更新された初期データ
 */
function kakeibo_deleteTransaction(id) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const allData = sheets.transactionsSheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === id) {
        sheets.transactionsSheet.deleteRow(i + 1);
        myLogger(`トランザクションを削除しました: ID ${id}`);
        break;
      }
    }
    kakeibo_updateBalances(sheets);
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_deleteTransaction', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * 資金を割り当てる。
 * @param {Array<Object>} allocations - 割り当てデータ
 * @returns {Object} 更新された初期データ
 */
function kakeibo_allocateFunds(allocations) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const date = new Date();
    allocations.forEach(alloc => {
      const allocId = 'T-' + new Date().getTime() + '-A-' + alloc.category;
      sheets.transactionsSheet.appendRow([allocId, date, '振分', alloc.amount, alloc.category, '月次振分']);
      
      if (alloc.isExpense) {
        const expenseId = 'T-' + new Date().getTime() + '-E-' + alloc.category;
        sheets.transactionsSheet.appendRow([expenseId, date, '支出', alloc.amount, alloc.category, '月次消費']);
      }
    });
    kakeibo_updateBalances(sheets);
    myLogger(`資金を割り当てました: ${allocations.length}件`);
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_allocateFunds', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * テンプレートを保存する。
 * @param {string} templateName - テンプレート名
 * @param {Object} templateData - テンプレートデータ
 * @returns {Object} 更新された初期データ
 */
function kakeibo_saveAllocationTemplate(templateName, templateData) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const allData = sheets.templatesSheet.getDataRange().getValues();
    // 既存の同名テンプレートを削除
    for (let i = allData.length - 1; i > 0; i--) {
      if (allData[i][0] === templateName) {
        sheets.templatesSheet.deleteRow(i + 1);
      }
    }
    // 新しいテンプレートデータを追加
    templateData.incomes.forEach(item => {
      sheets.templatesSheet.appendRow([templateName, '収入', item.category, item.amount, '']);
    });
    templateData.allocations.forEach(item => {
      sheets.templatesSheet.appendRow([templateName, '振分', item.category, item.amount, item.isExpense]);
    });
    myLogger(`テンプレート「${templateName}」を保存しました。`);
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_saveAllocationTemplate', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * アカウントを保存する。
 * @param {Object} accountData - アカウントデータ
 * @returns {Object} 更新された初期データ
 */
function kakeibo_saveAccount(accountData) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const allAccounts = sheets.accountsSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < allAccounts.length; i++) {
      if (allAccounts[i][6] === accountData.id) { // ID列で検索
        rowIndex = i + 1;
        break;
      }
    }
    
    const newRowData = [
      accountData.category,
      null, // 残高は後で更新される想定
      accountData.type,
      accountData.group,
      accountData.goal || 0,
      accountData.isDefault,
      accountData.id || ('A-' + new Date().getTime()) // IDがなければ生成
    ];

    if (rowIndex > -1) {
      sheets.accountsSheet.getRange(rowIndex, 1, 1, newRowData.length).setValues([newRowData]);
    } else {
      sheets.accountsSheet.appendRow(newRowData);
    }

    kakeibo_updateBalances(sheets); // 残高を更新
    myLogger(`アカウント「${accountData.category}」を保存しました。`);
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_saveAccount', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * アカウントを削除する。
 * @param {string} id - 削除するアカウントのID
 * @returns {Object} 更新された初期データ
 */
function kakeibo_deleteAccount(id) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const allAccounts = sheets.accountsSheet.getDataRange().getValues();
    for (let i = 1; i < allAccounts.length; i++) {
      if (allAccounts[i][6] === id) { // ID列で検索
        sheets.accountsSheet.deleteRow(i + 1);
        myLogger(`アカウントID ${id} を削除しました。`);
        break;
      }
    }
    kakeibo_updateBalances(sheets); // 残高を更新
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_deleteAccount', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * 将来の支出を保存する。
 * @param {Object} data - 将来の支出データ
 * @returns {Object} 更新された初期データ
 */
function kakeibo_saveFutureExpense(data) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const allData = sheets.futureExpensesSheet.getDataRange().getValues();
    
    const expenseDate = new Date(data.date); // 日付をDateオブジェクトに変換

    if (data.id) { // 既存の支出を更新
      for (let i = 1; i < allData.length; i++) {
        if (allData[i][0] === data.id) { // IDで検索
          sheets.futureExpensesSheet.getRange(i + 1, 2, 1, 4).setValues([[data.name, data.amount, expenseDate, data.sourceAccount]]);
          myLogger(`将来の支出ID ${data.id} を更新しました。`);
          break;
        }
      }
    } else { // 新規追加
      const id = 'FE-' + new Date().toISOString().replace(/[-:.]/g, ''); // 新しいID生成
      sheets.futureExpensesSheet.appendRow([id, data.name, data.amount, expenseDate, data.sourceAccount]);
      myLogger(`新しい将来の支出「${data.name}」を保存しました。`);
    }
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_saveFutureExpense', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

/**
 * 将来の支出を削除する。
 * @param {string} id - 削除する将来の支出のID
 * @returns {Object} 更新された初期データ
 */
function kakeibo_deleteFutureExpense(id) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const allData = sheets.futureExpensesSheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === id) { // IDで検索
        sheets.futureExpensesSheet.deleteRow(i + 1);
        myLogger(`将来の支出ID ${id} を削除しました。`);
        break;
      }
    }
    return kakeibo_getInitialData();
  } catch (e) {
    handleError('kakeibo_deleteFutureExpense', e, true);
    return kakeibo_getInitialData();
  } finally {
    LOCK.releaseLock();
  }
}

// =================================================================
// データ集計・計算
// =================================================================

/**
 * ダッシュボード表示用の集計データを取得する。
 * @param {Object} sheets - シートオブジェクトのコンテナ
 * @returns {Object} ダッシュボードデータ
 */
function kakeibo_getDashboardData(sheets) {
  const accounts = kakeibo_getAccounts(sheets);
  const transactions = kakeibo_getTransactions(sheets);
  
  let toBeBudgeted = 0;
  transactions.forEach(t => {
    if (t.type === '収入') toBeBudgeted += t.amount;
    if (t.type === '振分') toBeBudgeted -= t.amount;
  });
  myLogger("ダッシュボードデータを取得しました。");
  return { accounts, toBeBudgeted };
}

/**
 * 各アカウントの残高を更新する。
 * @param {Object} sheets - シートオブジェクトのコンテナ
 */
function kakeibo_updateBalances(sheets) {
  const accounts = kakeibo_getAccounts(sheets);
  const accountMap = accounts.reduce((map, acc) => {
    map[acc.category] = 0;
    return map;
  }, {});

  const transactions = kakeibo_getTransactions(sheets);
  transactions.forEach(t => {
    if (accountMap.hasOwnProperty(t.category)) {
      if (t.type === '振分') accountMap[t.category] += t.amount;
      if (t.type === '支出') accountMap[t.category] -= t.amount;
    }
  });
  
  const accountData = accounts.map(acc => {
    return [acc.category, accountMap[acc.category] || 0, acc.type, acc.group, acc.goal, acc.isDefault, acc.id];
  });
  
  if (accountData.length > 0) {
    // 2行目から、取得したアカウント数分の行を更新する
    sheets.accountsSheet.getRange(2, 1, accountData.length, accountData[0].length).setValues(accountData);
  }
  myLogger("アカウント残高を更新しました。");
}

/**
 * シミュレーションデータを取得する。
 * @param {string} templateName - テンプレート名
 * @param {Array<string>} selectedItems - 選択されたアカウント/グループのリスト
 * @returns {Object} シミュレーション結果データ
 */
function kakeibo_getSimulationData(templateName, selectedItems) {
  initializeAppConfig(); // 全体設定を初期化
  const LOCK = LockService.getScriptLock();
  LOCK.waitLock(15000);
  try {
    const ss = getKakeiboSpreadsheet();
    const sheets = kakeibo_getSheetsHelper(ss);
    const templates = kakeibo_getTemplates(sheets);
    const template = templates[templateName];
    if (!template) throw new Error(`シミュレーションテンプレート「${templateName}」が見つかりません。`);

    const futureExpenses = kakeibo_getFutureExpenses(sheets);
    const accounts = kakeibo_getAccounts(sheets);
    
    let simulatedBalances = accounts.reduce((acc, cv) => {
      acc[cv.category] = cv.balance;
      return acc;
    }, {});

    const monthlyTemplateIncome = Object.values(template.incomes || {}).reduce((sum, amount) => sum + amount, 0);
    const totalMonthlyAllocation = Object.values(template.allocations || {}).reduce((sum, data) => sum + data.amount, 0);
    const monthlyCouplesSavingsIncrease = monthlyTemplateIncome - totalMonthlyAllocation;

    const simulationResults = {};
    selectedItems.forEach(item => {
      simulationResults[item.replace(/^(account-|group-)/, '')] = [];
    });
    
    for (let i = 0; i < 36; i++) { // 36ヶ月分のシミュレーション
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);
      const year = futureDate.getFullYear();
      const month = futureDate.getMonth();
      
      if (i > 0) { // 最初の月は初期残高を使用
        Object.entries(template.allocations || {}).forEach(([category, data]) => {
          if (simulatedBalances[category] !== undefined) {
            simulatedBalances[category] += data.amount;
          }
        });
        // '2人の貯金'というカテゴリがAccountsシートに存在する場合にのみ加算
        const couplesSavingsAccount = accounts.find(acc => acc.category === "2人の貯金");
        if (couplesSavingsAccount && simulatedBalances.hasOwnProperty("2人の貯金")) {
          simulatedBalances["2人の貯金"] += monthlyCouplesSavingsIncrease;
        }
      }

      futureExpenses.forEach(fe => {
        const feDate = new Date(fe.date);
        if (feDate.getFullYear() === year && feDate.getMonth() === month) {
          if (simulatedBalances.hasOwnProperty(fe.sourceAccount)) {
            simulatedBalances[fe.sourceAccount] -= fe.amount;
          }
        }
      });
      
      selectedItems.forEach(item => {
        const isGroup = item.startsWith('group-');
        const name = item.replace(/^(account-|group-)/, '');
        
        if (isGroup) {
          const groupTotal = accounts
            .filter(acc => acc.group === name)
            .reduce((sum, acc) => sum + (simulatedBalances[acc.category] || 0), 0);
          simulationResults[name].push(groupTotal);
        } else {
          simulationResults[name].push(simulatedBalances[name] || 0);
        }
      });
    }
    const labels = Array.from({length: 36}, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    });

    myLogger("シミュレーションデータを計算しました。");
    return { labels, datasets: simulationResults };
  } catch (e) {
    handleError('kakeibo_getSimulationData', e, true);
    return null; // エラー時はnullを返す
  } finally {
    LOCK.releaseLock();
  }
}
