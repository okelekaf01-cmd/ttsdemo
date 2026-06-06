import type { AlignmentData, SpeechResult } from '@/types'

const MODEL_ID = 'eleven_turbo_v2_5'
const VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.75,
  style: 0.45,
  use_speaker_boost: true,
}

function authHeaders() {
  return {
    'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    'Content-Type': 'application/json',
  }
}

export async function generateSpeechWithTimestamps(
  text: string,
  voiceId: string
): Promise<SpeechResult> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
    }
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return { audioBase64: data.audio_base64 as string, alignment: data.alignment as AlignmentData }
}

export async function generateSpeech(text: string, voiceId: string): Promise<string> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { ...authHeaders(), Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => '')}`)
  const buffer = await res.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}
