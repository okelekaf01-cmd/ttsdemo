import type { AlignmentData, SentenceWithTimestamps } from '@/types'

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z])/

export function splitSentences(text: string): string[] {
  return text.split(SENTENCE_BOUNDARY).filter(s => s.trim().length > 0)
}

export function buildEvenTimestamps(
  sentences: string[],
  audioDuration: number
): SentenceWithTimestamps[] {
  const step = audioDuration / sentences.length
  return sentences.map((text, i) => ({
    text,
    startTime: i * step,
    endTime: (i + 1) * step,
  }))
}

export function buildTimestampsFromAlignment(
  sentences: string[],
  alignment: AlignmentData
): SentenceWithTimestamps[] {
  const rawChars = alignment.characters.join('')
  const normalizedText = sentences.join(' ').replace(/\s+/g, '')
  const deviation =
    Math.abs(rawChars.length - normalizedText.length) / (normalizedText.length || 1)
  const audioDuration =
    alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1] ?? 0

  if (deviation > 0.05) {
    return buildEvenTimestamps(sentences, audioDuration)
  }

  let charIdx = 0
  return sentences.map((sentence, i) => {
    const startCharIdx = charIdx
    charIdx += sentence.replace(/\s+/g, '').length
    const endCharIdx = Math.min(charIdx - 1, alignment.character_end_times_seconds.length - 1)
    const safeStart = Math.min(startCharIdx, alignment.character_start_times_seconds.length - 1)

    return {
      text: sentence,
      startTime: alignment.character_start_times_seconds[safeStart],
      endTime:
        i === sentences.length - 1
          ? audioDuration
          : alignment.character_end_times_seconds[endCharIdx],
    }
  })
}
