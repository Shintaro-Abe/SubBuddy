# 進捗・計画は専用のプライベートリポジトリで管理する

SubBuddy の進捗・計画（ガント／ロードマップ）とアプリ構造図を、GitHub 上の専用プライベートリポジトリ（`Shintaro-Abe/SubBuddy-planning`）に集約する。メインリポジトリはパブリックで、Issue を作ると進捗が第三者に露出するため、進捗・図解を非公開 repo に隔離する。正本はメイン repo の `wbs/wbs.yml` とし、そこから planning repo へ手動・確認ゲート付きで片方向同期する。可視化は planning repo の Project ロードマップ（開始/目標日でバー表示）＋ `predecessors` から生成する Mermaid gantt、アプリ構造図は同 repo 内 `.md` の Mermaid（ER は `schema.prisma` から自動生成）で行う。

**Considered Options**

- パブリック repo に Issue 化: コード近接だが進捗が公開されてしまい要件に反する。
- プライベート Project ＋下書き項目のみ: 新 repo 不要だがサブイシュー不可、構造図の非公開な置き場所が別途必要。
- Notion へ移行: 視認性は高いが同期先が増え GitHub エコシステムから外れる。

**Consequences**

planning repo は非公開のため露出しない。Issue＋サブイシューで WBS の `level:1/2` 階層を表現、Project ロードマップでガント、Mermaid で構造図を描画できる。repo が 2 つに分かれるため、`wbs.yml`→planning repo の同期コマンド（`wbs/` に追加、`gh` CLI・`project` スコープ）と図解ミラー処理を新設する。既存の Google スプレッドシート同期は安定まで併存し、その後 GitHub に一本化する。
