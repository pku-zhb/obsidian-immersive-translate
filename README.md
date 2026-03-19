# Obsidian Immersive Translate

Obsidian 沉浸式翻译插件 —— 在笔记中逐段插入译文，原文与译文对照阅读。

## 功能

- 自动解析 Markdown 段落、标题、列表
- 跳过代码块、数学公式、表格、frontmatter 等非翻译内容
- 译文插入原文下方，保持原始文档结构
- 侧边面板预览翻译结果，确认后一键插入
- 支持 12 种语言，自动检测源语言

## 使用方法

1. 打开一篇笔记
2. `Cmd/Ctrl + P` → 搜索 "Translate current note"
3. 在右侧面板点击 **Translate**
4. 检查翻译结果，点击 **Insert into Note** 插入到笔记中

## 安装

手动安装：将 `main.js`、`manifest.json`、`styles.css` 复制到 vault 的 `.obsidian/plugins/obsidian-immersive-translate/` 目录下。

## 开发

```bash
bun install
bun run build    # 构建插件
bun run dev      # 开发模式（watch）
bun run test     # 运行测试
```

## 作者

- [zhuhuibin](https://github.com/zhuhuibin)
- [Claude Opus 4.6](https://claude.ai) (Co-Author)

## License

MIT
