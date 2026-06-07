export async function translateToEnglish(text: string): Promise<string> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate the Chinese voiceover script to natural, fluent English. Output only the translated text, no explanations.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return data.choices[0].message.content.trim() as string
}
