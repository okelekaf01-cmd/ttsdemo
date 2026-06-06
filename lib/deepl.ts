export async function translateToEnglish(text: string): Promise<string> {
  const endpoint = process.env.DEEPL_API_KEY?.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: [text], source_lang: 'ZH', target_lang: 'EN' }),
  })

  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return data.translations[0].text as string
}
