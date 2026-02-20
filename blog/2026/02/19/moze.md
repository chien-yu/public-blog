---
slug: moze-observation
---

# Moze 記帳工具觀察

:::info 同樂會
這是我的「[BlogBlog 同樂會 - 2026 年 2 月](https://blogblog.club/party)」的投稿文章。本月主題是「[只有我這樣嗎？](https://wiwi.blog/blog/blogblog-party-feb-2026/)」，由 Wiwi 主持。如果你有自己的部落格，歡迎一起來參加！
:::

從 PipperL 的[這篇文章](https://blog.serv.idv.tw/2020/05/pm2moze/) 認識了 [Moze](https://doc.moze.app/)。看到同樣熱衷於紀錄的人，很好奇他們的作業模式，以及為什麼工具選擇上會不同。

Moze 這個介面跟其他手機 App 的複雜度差不多，一般使用者的第一步，新增帳戶頁面就有 12 個設定。
<img src={require('./new-account.jpg').default} alt="新增帳戶頁面" style={{ width: '50%' }} />

許多在手機或平板上的記帳工具，可以方便使用者「隨手記錄」，但我覺得這是不必要的步驟。「隨時紀錄」增加的是時間軸上的帳目準確度，但這個意義大嗎？對我而言，要養成買飯、網購都要馬上紀錄的習慣太難。

我因為消費都是透過信用卡，每個月的帳單就已彙整了完整紀錄。所以我可以每個月只記錄一次，當然在記錄之前，這個月的帳目就不是準確地。但紀錄的過程只要透過大型語言模型就可以自動分類。之所以任意的語言模型可以接到記帳工具中，關鍵在於我的帳本格式就是[純文字檔](./pta-intro)而已。

當然也不是那麼勤勞的一有帳單出來就記帳，有時候某個帳戶也是兩三個月才去下載一次帳單，然後在 Antigravity 裡下指令：「請整理Ｘ帳戶 2025-11 到 2026-01 的帳單。」，等語言模型看完帳單把交易紀錄輸入進文字檔後，Antigravity 中的 [Beancount](https://github.com/beancount/beancount) 插件會及時檢查交易結果造成的帳戶餘額是否符合；如果語言模型列出的所有消費總和跟帳單上的總和不符，可以叫它再檢查一下，或是自己打開帳單比對。

Beancount 就是我在使用的 plaintextaccounting 工具，作者寫的[文檔](https://beancount.github.io/docs/index.html)十分精彩，完全不輸給 Moze 的[文檔](https://doc.moze.app/)。既然上面都提到了 Moze 的新增帳戶頁面，那我就比較一下 Beancount 這類純文字記帳工具的新增帳戶方式吧。

1. 在電腦上新增一份文字檔。
2. 在文字檔中輸入 `2026-01-01 open Assets:Bank:Fubon`

就這樣！
