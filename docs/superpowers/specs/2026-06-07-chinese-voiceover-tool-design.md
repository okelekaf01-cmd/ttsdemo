# 中文口播文本转英文翻译 + 语音工具 — 设计文档

**日期：** 2026-06-07  
**状态：** 已批准（v2，含 review 修正）

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
| 翻译 API 调用 | Server Action（纯文本，无大小问题） |
| 音频 API 调用 | API Route（二进制流，绕过 Server Action 4.5MB 限制） |
| 翻译 | DeepL API |
| 语音合成 | ElevenLabs API |
| 历史存储 | IndexedDB（浏览器端） |
| 部署 | Vercel |

---

## 项目结构

```
d:/interview/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── actions.ts                    # Server Action：仅翻译（纯文本，无大小限制）
│   └── api/
│       ├── tts-with-timestamps/
│       │   └── route.ts              # POST → 返回 JSON { audioBase64, alignment }
│       └── tts-multi/
│           └── route.ts              # POST → 返回 JSON [{ voiceId, audioBase64 }]
├── components/
│   ├── InputPanel.tsx                # 中文输入 + 字数统计 + 防抖提交
│   ├── ResultPanel.tsx               # 英文文本 + 复制 + 主音色播放
│   ├── HighlightPlayer.tsx           # 逐句高亮播放器
│   ├── VoiceComparison.tsx           # 多音色并排对比
│   └── HistoryPanel.tsx              # 左侧历史记录面板
├── hooks/
│   └── useVoiceoverTask.ts           # 状态机 hook：idle→translating→generating→done
├── lib/
│   ├── deepl.ts                      # DeepL API 封装
│   ├── elevenlabs.ts                 # ElevenLabs API 封装（含参数配置）
│   ├── history.ts                    # IndexedDB CRUD（含配额检查 + FIFO 清理）
│   ├── sentences.ts                  # 英文句子切割 + alignment sanity check
│   └── voices.config.ts              # 音色配置（ID、名称，不硬编码在组件里）
├── types/
│   └── index.ts
├── .env.local                        # 实际密钥（不提交）
├── .env.example                      # 变量说明模板（提交到 repo）
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
│  历史记录    │  │  [textarea]  0 / 2000 字         │ │
│              │  │  [▶ 生成翻译 + 语音]             │ │
│  ▶ 割草机器人│  └──────────────────────────────────┘ │
│  ▶ 产品介绍  │  ┌─ 英文结果 ──────────────────────┐ │
│  ▶ 活动预告  │  │  Translated text with highlight  │ │
│              │  │  [📋 复制] [▶ 播放] [⬇ 下载]    │ │
│              │  └──────────────────────────────────┘ │
│              │  ┌─ 多音色对比（Josh/Elli/Adam）───┐ │
│              │  │  Josh ▶  Elli ▶  Adam ▶          │ │
│              │  │  [选定音色后下载]                │ │
│              │  └──────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────┘
```

---

## 数据流

```
用户输入中文（≤2000字）
    │
    ▼
Server Action: translateText()
    │ DeepL API（纯文本，Server Action 安全）
    ▼
英文文本
    │
    ├──▶ fetch POST /api/tts-with-timestamps  (主音色 Rachel)
    │         │ ElevenLabs /with-timestamps
    │         ▼
    │    JSON { audioBase64, alignment }
    │         │
    │         ├──▶ HighlightPlayer（逐句高亮）
    │         └──▶ 存入 IndexedDB 历史（FIFO，最多 20 条）
    │
    └──▶ fetch POST /api/tts-multi  (Josh, Elli, Adam — 不含 Rachel)
              │ Promise.all × 3 音色
              ▼
         [Josh, Elli, Adam] × { audioBase64 }
              │
              ▼
         VoiceComparison（并排试听，Rachel 直接复用上面的结果）
```

**Rachel 只生成一次**，多音色对比面板从主音色结果中直接取用。

---

## API Routes

### `POST /api/tts-with-timestamps`

```ts
// Request
{ text: string, voiceId: string }

// Response（application/json）
{ audioBase64: string, alignment: AlignmentData }
```

调用 ElevenLabs `/v1/text-to-speech/{voiceId}/with-timestamps`，在 Route Handler 中处理，无 Server Action body 限制。

### `POST /api/tts-multi`

```ts
// Request
{ text: string, voiceIds: string[] }  // 只传 Josh, Elli, Adam

// Response（application/json）
Array<{ voiceId: string, audioBase64: string }>
```

服务端 `Promise.all` 并发请求，返回 JSON 数组。

### Server Action `translateText(chineseText: string): Promise<string>`

保留为 Server Action，纯文本响应无大小问题。内置简单 in-memory rate limiter（同一 IP 每分钟最多 10 次）。

---

## ElevenLabs 语音参数

```ts
// lib/elevenlabs.ts
const MODEL_ID = "eleven_turbo_v2_5"  // 更快、更便宜，降低 Vercel 超时风险

const VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.75,
  style: 0.45,
  use_speaker_boost: true,
}
```

```ts
// lib/voices.config.ts  — 音色配置集中管理，不散落在组件里
export const VOICES = {
  primary: { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  comparison: [
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  ],
}
```

---

## 逐句高亮实现

**句子切割（`lib/sentences.ts`）：**

```ts
// 不用简单的 . ! ? 切割，避免误切 "3.5mm"、"Dr."、"U.S."
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z])/
```

**Alignment Sanity Check：**

```ts
// 拿到 alignment 后验证长度一致性
const rawChars = alignment.characters.join('')
const normalizedText = text.replace(/\s+/g, '')
const deviation = Math.abs(rawChars.length - normalizedText.length) / normalizedText.length
if (deviation > 0.05) {
  // 降级：按句子数均匀分配音频时长
  return buildEvenTimestamps(sentences, audioDuration)
}
```

**播放同步：**

```tsx
audio.ontimeupdate = () => {
  const t = audio.currentTime
  const idx = sentences.findIndex(s => t >= s.startTime && t < s.endTime)
  setHighlightedIdx(idx)
}
```

---

## 状态机（`hooks/useVoiceoverTask.ts`）

```ts
type TaskState = 'idle' | 'translating' | 'generating' | 'done' | 'error'

// 管理：chineseText, englishText, speechResult, multiVoiceResults, error
// InputPanel / ResultPanel / VoiceComparison 均从这个 hook 取数据
// 避免各组件重复同步 state
```

---

## 输入校验与防护

| 项目 | 措施 |
|------|------|
| 输入字数 | 前端：textarea maxLength=2000，实时计数显示；后端：API Route 校验拒绝超长请求 |
| 按钮防抖 | `useVoiceoverTask` 内部用 `isLoading` state 禁用按钮，防止重复提交 |
| Rate limiting | Server Action + API Routes 共享 in-memory Map，同 IP 每分钟 ≤10 次请求 |
| 请求缓存 | 以 SHA-256(chineseText) 为 key，服务端内存缓存翻译结果 5 分钟（不缓存音频） |
| CSRF | Next.js App Router Server Actions 内置 CSRF 校验；API Routes 通过 `Origin` header 验证 |

---

## 历史记录（IndexedDB）

**数据库：** `voiceover-history` v1，Store: `records`，keyPath: `id`

```ts
interface HistoryRecord {
  id: string
  createdAt: number
  chineseText: string
  englishText: string
  audioBlob: Blob          // 主音色（Rachel）音频
  voiceId: string
  alignment: AlignmentData
}
```

**存储管理（`lib/history.ts`）：**

- 每次写入后，如记录超过 **20 条**，删除最旧的条目（FIFO）
- 写入前调用 `estimateQuota()`：若可用空间 <10MB 或 IndexedDB 不可用，降级为 sessionStorage（无音频，仅保存文本）
- 多音色对比音频**不存历史**

点击历史条目：从 IndexedDB 读取，直接恢复 ResultPanel 和 HighlightPlayer 状态，无需重新调 API。

---

## 环境变量

**.env.example（提交到 repo）：**

```
# DeepL API
DEEPL_API_KEY=your_deepl_api_key_here

# ElevenLabs API
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

**.env.local（本地/Vercel 环境变量，不提交）：**

```
DEEPL_API_KEY=...
ELEVENLABS_API_KEY=...
```

---

## 错误处理

- DeepL 调用失败：显示内联错误，任务回到 `error` 状态，允许重试
- 单个音色生成失败：其余音色正常展示，失败项显示重试按钮
- alignment 偏差 >5%：自动降级均匀分配时间戳，不中断播放
- IndexedDB 不可用：降级 sessionStorage，UI 提示"历史仅在本次会话保留"

---

## 不在范围内

- 用户认证 / 多用户
- 服务端历史持久化
- 自定义 ElevenLabs 音色上传
- 移动端优化（桌面优先）
