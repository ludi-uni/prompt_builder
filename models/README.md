# Models

ここに GGUF モデルを置いてください。

```text
models/
└── your-model.gguf
```

`config/llama.yaml` の `model:` にパスを指定して `npm run llama` で起動します。

## 入手例

- [Hugging Face](https://huggingface.co/models?library=gguf) から GGUF をダウンロード
- [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases) から `llama-server` を取得
