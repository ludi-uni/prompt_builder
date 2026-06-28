# Prompt Studio

レイヤー型プロンプト IDE。Markdown を部品化し、`build.yaml` で結合順を定義してプレビュー・LLM テスト・リグレッション検証ができます。

## 機能

- **Components** — レイヤー単位で Markdown 部品を管理・並べ替え
- **Editor** — Monaco による Markdown 編集（手動 Save）
- **生成プロンプト / プレビュー / テスト** — 右ペインのタブで切り替え
- **Diff** — 初期プロンプトまたは前回 Save 時点との差分（Raw / プレビュー両方）
- **Regression** — llama-server KV スロットキャッシュを使った一括テスト（[仕様](docs/リグレッション仕様.md)）

## 前提

- Node.js 18+
- Python 3.10+
- （任意）llama.cpp `llama-server` + GGUF モデル — LLM テスト・リグレッション用

**すべてのコマンドはプロジェクトルートで実行してください。**

## クイックスタート

```powershell
git clone https://github.com/ludi-uni/prompt_builder.git
cd prompt_builder
npm install
npm run setup        # venv・依存関係・config/*.yaml を example から生成
npm run dev
```

- GUI: [http://127.0.0.1:61010](http://127.0.0.1:61010)
- API docs: [http://127.0.0.1:61000/docs](http://127.0.0.1:61000/docs)

ポートは使用中の場合 61001 等に自動でずらされます。固定する場合:

```powershell
$env:PROMPT_STUDIO_API_PORT = "61000"
$env:PROMPT_STUDIO_WEB_PORT = "61010"
npm run dev
```



## コマンド一覧


| コマンド                   | 説明                           |
| ---------------------- | ---------------------------- |
| `npm run setup`        | 初回セットアップ                     |
| `npm run dev`          | Backend + Frontend           |
| `npm run dev:all`      | llama-server + Prompt Studio |
| `npm run llama`        | llama-server 起動              |
| `npm run test`         | Backend テスト                  |
| `npm run build`        | Frontend 本番ビルド               |
| `npm run lint`         | Frontend + Backend Lint      |
| `npm run format`       | フォーマット                       |
| `npm run format:check` | フォーマット差分チェック（CI 向け）          |




## ディレクトリ構成

```text
prompt_builder/
├── frontend/          # React + Vite GUI
├── backend/           # FastAPI API
├── layers/            # レイヤー Markdown + layers.yaml
├── build.yaml         # プロンプト結合順
├── regression/        # リグレッションスイート定義
├── workspace/         # 生成物・KV キャッシュ（git 除外）
├── models/            # GGUF モデル置き場（git 除外）
├── config/            # 設定（*.example を setup でコピー）
└── docs/              # 仕様書
```



## 使い方

1. **Components** で Markdown ファイルを選択
2. 左ペイン **Editor** で編集 → **Save**（`Ctrl+S`）で保存・プロンプト再ビルド
3. 右ペイン **生成プロンプト** — Raw / Diff / vs Git
4. 右ペイン **プレビュー** — レンダリング / Diff / vs Git
5. 右ペイン **テスト** — Single Test / Regression
6. **Export to workspace** — `⋯` メニュー または `Ctrl+Shift+E`



### ショートカット


| キー             | 動作                      |
| -------------- | ----------------------- |
| `Ctrl+S`       | 保存                      |
| `Ctrl+Shift+E` | workspace に Export      |
| `Ctrl+Shift+S` | Regression: Snapshot 更新 |
| `Ctrl+Shift+R` | Regression: Run Suite   |




## LLM 設定（llama.cpp）



### 1. モデル配置

```text
models/your-model.gguf
```



### 2. 設定ファイル

setup で `config/*.example` からコピーされます。手動で編集する場合:

`config/llama.yaml` — `npm run llama` 用

```yaml
server:
  host: 127.0.0.1
  port: 8080
model: models/your-model.gguf
extra_args:
  - --slot-save-path
  - workspace/regression/kv
```

`config/llm.yaml` — Prompt Studio からの接続先

```yaml
server_url: http://127.0.0.1:8080
timeout_seconds: 120.0
disable_reasoning: true
```

`config/llama.yaml` と `config/llm.yaml` は `.gitignore` 対象です。リポジトリには `*.example` のみ含まれます。

### 3. 起動

```powershell
npm run llama          # ターミナル 1
npm run dev            # ターミナル 2
# または
npm run dev:all
```

GUI の **LLM** ボタンで接続先を確認・変更できます。

## build.yaml

```yaml
name: Prompt
build:
  - layer: system
    prompts:
      - role.md
      - safety.md
  - layer: persona
    prompts:
      - identity.md
      - speech.md
```

Markdown 結合時の区切りは `\n\n---\n\n` です。

## 公開リポジトリについて


| 含まれる               | 含まれない（`.gitignore`）                               |
| ------------------ | ------------------------------------------------- |
| ソース・サンプル layers    | `config/llm.yaml`, `config/llama.yaml`            |
| `config/*.example` | `models/*.gguf`                                   |
| リグレッションスイート定義      | `workspace/regression/kv/`, `runs/`, `snapshots/` |
| ドキュメント             | `.venv/`, `node_modules/`                         |


初回 clone 後は必ず `npm run setup` を実行してください。

## ドキュメント

- [仕様書](docs/仕様書.md)
- [リグレッション仕様](docs/リグレッション仕様.md)
- [追加仕様](docs/追加仕様.md)



## ライセンス

[MIT](LICENSE)
