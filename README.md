# Prompt Studio

レイヤー型プロンプト IDE。Markdown を部品化し、`build.yaml` で結合順を定義してプレビュー・テストできます。

## 前提

- Node.js 18+
- Python 3.10+
- **すべてのコマンドはプロジェクトルート（`prompt_builder/`）で実行**

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `npm run setup` | 初回セットアップ（venv・依存関係・`config/llm.yaml`） |
| `npm run dev` | Backend + Frontend を同時起動 |
| `npm run dev:all` | llama-server + Prompt Studio を同時起動 |
| `npm run llama` | llama-server を起動（要 GGUF モデル） |
| `npm run dev:api` | Backend のみ起動 |
| `npm run dev:web` | Frontend のみ起動 |
| `npm run test` | Backend テスト実行 |
| `npm run build` | Frontend 本番ビルド |
| `npm run lint` | Frontend + Backend Lint |
| `npm run lint:web` | Frontend Lint（oxlint） |
| `npm run lint:api` | Backend Lint（ruff） |
| `npm run format` | Frontend + Backend フォーマット |
| `npm run format:web` | Frontend フォーマット（oxfmt） |
| `npm run format:api` | Backend フォーマット（ruff） |
| `npm run format:check` | フォーマット差分チェック（CI 向け） |

### 初回

```powershell
cd prompt_builder
npm install          # concurrently 等（ルート）
npm run setup        # Python venv + frontend 依存関係
npm run dev
```

- GUI: http://127.0.0.1:61010
- API docs: http://127.0.0.1:61000/docs

### 2 回目以降

```powershell
cd prompt_builder
npm run dev
```

デフォルトは **61000番台**（API: 61000、GUI: 61010）です。使用中の場合は 61001、61011 等を自動で選びます。起動ログに実際の URL が表示されます。

### ポートを固定する場合

```powershell
$env:PROMPT_STUDIO_API_PORT = "61000"
$env:PROMPT_STUDIO_WEB_PORT = "61010"
npm run dev
```

使用中のポートを指定するとエラーになります。先に既存プロセスを停止してください。

```powershell
# 例: 61000 を使っている PID を確認
netstat -ano | findstr :61000
```

## ディレクトリ構成

```text
prompt_builder/
├── package.json       # ルートコマンド（npm run dev 等）
├── scripts/           # setup / dev / test スクリプト
├── frontend/          # React + Vite GUI
├── backend/           # FastAPI API
├── layers/            # レイヤー Markdown + layers.yaml
├── build.yaml         # プロンプト結合順の定義
├── workspace/         # 生成物出力先
├── models/            # GGUF モデル置き場
└── config/            # LLM / llama-server 設定
```

## 使い方（v0.2）

1. **Components** ボタンで左スライドオーバーから Markdown ファイルを選択
2. 中央 **Editor** で編集（停止 500ms 後に自動保存 → Prompt 自動更新）
3. Components 内 **↑↓** で結合順を変更（`build.yaml` に保存）
4. **RUN TEST** で LLM 動作確認（右ペイン **Test Result** に出力・メトリクス表示）
5. **Show Prompt** で完成 Prompt を表示（**Full / Diff / vs Git** タブ）
6. workspace 出力は **⋯ メニュー → Export to workspace**（`Ctrl+Shift+E`）

### ショートカット

| キー | 動作 |
|------|------|
| `Ctrl+S` | 即時保存 |
| `Ctrl+Shift+E` | workspace に Export |

## LLM 設定（llama.cpp）

Prompt Studio は llama-server（llama.cpp）の OpenAI 互換 API に接続します。

### クイックスタート

```powershell
# 1. llama-server をインストール（PATH に llama-server が通る状態にする）
#    https://github.com/ggml-org/llama.cpp/releases

# 2. GGUF モデルを models/ に配置
#    例: models/your-model.gguf

# 3. config/llama.yaml でモデルパスを指定（npm run setup で自動生成）
#    model: models/your-model.gguf

# 4. llama-server を起動
npm run llama

# 5. 別ターミナルで Prompt Studio を起動
npm run dev
```

`npm run dev:all` で llama-server と Prompt Studio を同時起動できます。

### GUI からの設定

1. **LLM** ボタン → Server URL を確認（デフォルト: `http://127.0.0.1:8080`）
2. **接続確認** で llama-server への接続をテスト
3. **Run Test** でプロンプトを LLM に送信

ツールバーの LLM 表示: `✓` 接続 OK / `!` 未接続 / `○` 未設定

### 設定ファイル

**`config/llama.yaml`** — llama-server 起動用（`npm run llama`）

```yaml
server:
  host: 127.0.0.1
  port: 8080
model: models/your-model.gguf
ctx_size: 4096
n_gpu_layers: -1
```

**`config/llm.yaml`** — Prompt Studio からの接続先

```yaml
server_url: http://127.0.0.1:8080
timeout_seconds: 120.0
```

環境変数で上書き可能: `LLAMA_MODEL`, `LLAMA_SERVER`, `LLAMA_HOST`, `LLAMA_PORT`

## build.yaml

プロンプトの結合順はルートの `build.yaml` で定義します。Components パネルの ↑↓ 操作でも更新されます。

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

Markdown 結合時は `\n\n---\n\n` で区切られます。`build.yaml` が無い場合は、登録済み Component の Markdown から自動生成されます。

## ライセンス

（未定）
