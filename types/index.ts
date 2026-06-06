export interface AlignmentData {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export interface SpeechResult {
  audioBase64: string
  alignment: AlignmentData
}

export interface MultiVoiceResult {
  voiceId: string
  voiceName: string
  audioBase64: string | null
  error?: string
}

export interface HistoryRecord {
  id: string
  createdAt: number
  chineseText: string
  englishText: string
  audioBlob: Blob
  voiceId: string
  alignment: AlignmentData
}

export interface SentenceWithTimestamps {
  text: string
  startTime: number
  endTime: number
}

export type TaskState = 'idle' | 'translating' | 'generating' | 'done' | 'error'
