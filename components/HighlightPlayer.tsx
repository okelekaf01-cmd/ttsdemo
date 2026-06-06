'use client'
import { useEffect, useRef, useState } from 'react'
import { splitSentences, buildTimestampsFromAlignment } from '@/lib/sentences'
import type { SentenceWithTimestamps, SpeechResult } from '@/types'

interface HighlightPlayerProps { englishText: string; speechResult: SpeechResult }

export function HighlightPlayer({ englishText, speechResult }: HighlightPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const sentencesRef = useRef<SentenceWithTimestamps[]>([])

  useEffect(() => {
    const bytes = Uint8Array.from(atob(speechResult.audioBase64), c => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
    setAudioUrl(url)
    sentencesRef.current = buildTimestampsFromAlignment(splitSentences(englishText), speechResult.alignment)
    return () => URL.revokeObjectURL(url)
  }, [speechResult, englishText])

  const onTimeUpdate = () => {
    const t = audioRef.current?.currentTime ?? 0
    setActiveIdx(sentencesRef.current.findIndex(s => t >= s.startTime && t < s.endTime))
  }

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={audioUrl} controls onTimeUpdate={onTimeUpdate}
        onEnded={() => setActiveIdx(-1)} className="w-full" />
      <div className="text-sm leading-loose">
        {splitSentences(englishText).map((s, i) => (
          <span key={i} className={`rounded px-0.5 transition-colors ${i === activeIdx ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>
            {s}{' '}
          </span>
        ))}
      </div>
    </div>
  )
}
