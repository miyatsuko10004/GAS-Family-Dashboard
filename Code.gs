// Code.gs (createTemplateFromFileテスト用の一時修正)
function doGet(e) {
  // initializeAppConfig(); // テストのためコメントアウト

  const template = HtmlService.createTemplateFromFile('DashboardUI');
  template.myTestVariable = "Hello from template!"; // テスト変数を渡す

  return template.evaluate()
      .setTitle('Template Test')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}