# 中文口播文本转英文翻译 + 语音工具 — 设计文档

**日期：** 2026-06-07  
**状态：** 已批准

---

## 概述

一个 Next.js 网页工具，让运营人员输入中文口播文案，一键获得英文翻译、可播放/下载的英文语音、多音色对比，以及带逐句高亮的音频播放器。历史记录本地持久化，无需登录。

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| API 调用 | Server Actions |
| 翻译 | DeepL API |
| 语音合成 | ElevenLabs API |
| 历史存储 | IndexedDB（浏览器端） |
| 部署 | Vercel |

---

## 项目结构

```
d:/interview/
├── app/
│   ├── page.tsx              # 主页面
│   ├── layout.tsx
│   └── actions.ts            # 全部 Server Actions
├── components/
│   ├── InputPanel.tsx        # 中文输入框 + 生成按钮
│   ├── ResultPanel.tsx       # 英文文本展示 + 复制 + 主音色播放
│   ├── HighlightPlayer.tsx   # 逐句高亮音频播放器
│   ├── VoiceComparison.tsx   # 多音色并排对比
│   └── HistoryPanel.tsx      # 左侧历史记录面板
├── lib/
│   ├── deepl.ts              # DeepL API 封装
│   ├── elevenlabs.ts         # ElevenLabs API 封装
│   └── history.ts            # IndexedDB CRUD
├── types/
│   └── index.ts              # 共享类型定义
├── .env.local                # DEEPL_API_KEY, ELEVENLABS_API_KEY
└── .gitignore
```

---

## 页面布局

**C 型：左侧历史面板 + 右侧主工作区**

```
┌─────────────────────────────────────────────────────┐
│  🎙️ 口播翻译工具                                     │
├──────────────┬──────────────────────────────────────┤
│              │  ┌─ 中文输入 ──────────────────────┐ │
│  历史记录    │  │  [textarea]                      │ │
│              │  │  [▶ 生成翻译 + 语音]             │ │
│  ▶ 割草机器人│  └──────────────────────────────────┘ │
│  ▶ 产品介绍  │  ┌─ 英文结果 ──────────────────────┐ │
│  ▶ 活动预告  │  │  Translated text with highlight  │ │
│              │  │  [📋 复制] [▶ 播放] [⬇ 下载]    │ │
│              │  └──────────────────────────────────┘ │
│              │  ┌─ 多音色对比 ────────────────────┐ │
│              │  │  Rachel ▶  Josh ▶  Elli ▶  Adam ▶│ │
│              │  │  [选定音色后下载]                │ │
│              │  └──────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────┘
```

---

## 数据流

```
用户输入中文
    │
    ▼
Server Action: translateText()
    │ DeepL API
    ▼
英文文本
    │
    ├──▶ Server Action: generateSpeechWithTimestamps()
    │         │ ElevenLabs /with-timestamps (主音色 Rachel)
    │         ▼
    │    { audioBase64, alignment }
    │         │
    │         ├──▶ HighlightPlayer（逐句高亮）
    │         └──▶ 存入 IndexedDB 历史
    │
    └──▶ Server Action: generateMultiVoice()
              │ Promise.all × 4 音色
              ▼
         [Rachel, Josh, Elli, Adam] × { audioBase64 }
              │
              ▼
         VoiceComparison（并排试听）
```

---

## Server Actions

### `translateText(chineseText: string): Promise<string>`
调用 DeepL API，source_lang=ZH，target_lang=EN，返回英文字符串。

### `generateSpeechWithTimestamps(text: string, voiceId: string): Promise<SpeechResult>`
调用 ElevenLabs `/v1/text-to-speech/{voiceId}/with-timestamps`，返回：
```ts
interface SpeechResult {
  audioBase64: string
  alignment: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
}
```

### `generateMultiVoice(text: string, voiceIds: string[]): Promise<MultiVoiceResult[]>`
并发调用 ElevenLabs 标准 TTS 接口（不需要 timestamps），每个音色一个请求，`Promise.all` 并行执行。

---

## ElevenLabs 语音参数

```ts
const VOICE_SETTINGS = {
  model_id: "eleven_multilingual_v2",
  voice_settings: {
    stability: 0.35,          // 低 = 更有情感起伏，接近真人口播
    similarity_boost: 0.75,
    style: 0.45,
    use_speaker_boost: true,
  }
}

const COMPARISON_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },  // 清晰女声
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },    // 低沉男声
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },    // 活泼女声
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },    // 专业男声
]
```

---

## 逐句高亮实现

1. 英文文本按标点（`.!?`）切割为句子数组
2. 每个句子计算起止字符索引，映射到 alignment 时间戳
3. 句子开始时间 = `character_start_times_seconds[sentenceStartCharIdx]`
4. 句子结束时间 = `character_end_times_seconds[sentenceEndCharIdx]`
5. `<audio>` 元素 `ontimeupdate` 事件中，找到 `currentTime` 所在句子，更新高亮 state

```tsx
// 示意
audio.ontimeupdate = () => {
  const t = audio.currentTime
  const idx = sentences.findIndex(s => t >= s.startTime && t < s.endTime)
  setHighlightedIdx(idx)
}
```

---

## 历史记录（IndexedDB）

**数据库：** `voiceover-history`，版本 1  
**Store：** `records`，keyPath: `id`

```ts
interface HistoryRecord {
  id: string                    // crypto.randomUUID()
  createdAt: number             // Date.now()
  chineseText: string
  englishText: string
  audioBlob: Blob               // 主音色（Rachel）音频
  voiceId: string               // 主音色 ID
  alignment: AlignmentData      // 用于历史条目回放时的高亮
}
```

历史面板点击条目：从 IndexedDB 读取，直接恢复 ResultPanel 和 HighlightPlayer 状态，无需重新调 API。

多音色对比的其他音色音频**不存历史**（避免存储膨胀）。

---

## 环境变量

```
DEEPL_API_KEY=...
ELEVENLABS_API_KEY=...
```

---

## 错误处理

- DeepL / ElevenLabs 调用失败：UI 内联显示错误提示，不 crash
- IndexedDB 不可用（隐私模式）：降级为 sessionStorage，提示用户
- 多音色并发中单个失败：其余音色正常展示，失败项显示重试按钮

---

## 不在范围内

- 用户认证 / 多用户
- 服务端历史持久化
- 自定义 ElevenLabs 音色上传
- 移动端优化（桌面优先）
