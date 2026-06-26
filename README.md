# Prompt Studio

レイヤー型プロンプト IDE。Markdown を部品化し、Export 定義で用途ごとに組み立て・プレビュー・テストできます。

## 前提

- Node.js 18+
- Python 3.10+
- **すべてのコマンドはプロジェクトルート（`prompt_builder/`）で実行**

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `npm run setup` | 初回セットアップ（venv・依存関係・`config/llm.yaml`） |
| `npm run dev` | Backend + Frontend を同時起動 |
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
├── exports/           # Export 定義 YAML
├── workspace/         # 生成物出力先
└── config/            # LLM 設定（llm.yaml）
```

## 使い方

1. 左ペインでレイヤー・Markdown ファイルを選択
2. 中央ペインで編集（Edit / Preview タブ、Ctrl+S で保存）
3. 上部 Export ドロップダウンで用途を切り替え
4. 右ペインで完成 Prompt を Rendered / Raw 表示
5. **Export Prompt** で `workspace/generated_prompt.md` に出力（クリップボードにもコピー）
6. **Run Test** で LLM 動作確認（任意）

## LLM 設定（llama-server）

1. ローカルで llama-server を起動
2. GUI の **LLM** ボタンから URL を設定（デフォルト: `http://127.0.0.1:8080`）
3. または `config/llm.yaml` を編集（`npm run setup` で example から自動生成）

```yaml
server_url: http://127.0.0.1:8080
timeout_seconds: 120.0
```

## Export の追加

`exports/` に YAML を追加:

```yaml
name: My Export

build:
  - layer: system
    prompts:
      - role.md
      - safety.md
  - layer: persona
    prompts:
      - identity.md
```

Markdown 結合時は `\n\n---\n\n` で区切られます。

## ライセンス

（未定）
