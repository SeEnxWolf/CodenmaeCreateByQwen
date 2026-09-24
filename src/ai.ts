// DeepSeek API integration for AI master hints
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function generateAIHint(
  secretWords: string[],
  allWords: string[],
  blackWord: string,
  round: number,
  previousHints: string[],
  apiKey: string
): Promise<{ word: string; count: number }> {
  const systemPrompt = `Ты играешь в игру "Кодовое Имя". Ты мастер и должен дать подсказку игрокам.

Правила:
- Ты даёшь ОДНО слово-подсказку и число (сколько слов связано с подсказкой)
- Подсказка должна связывать несколько загаданных слов общим понятием
- Нельзя использовать сами загаданные слова или их части
- Нельзя использовать чёрное слово

Загаданные слова (игроки должны их найти): ${secretWords.join(', ')}
Все слова на поле: ${allWords.join(', ')}
Чёрное слово (опасное!): ${blackWord}
Раунд: ${round}
${previousHints.length > 0 ? `Предыдущие подсказки: ${previousHints.join(', ')}` : ''}

Ответь СТРОГО в формате: СЛОВО ЧИСЛО
Например: еда 3`;

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Дай подсказку для текущего раунда.' }
  ];

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    
    // Parse response: "word number"
    const parts = content.split(/\s+/);
    const hintWord = parts[0] || 'подсказка';
    const hintCount = parseInt(parts[1]) || Math.min(3, secretWords.length);

    return { word: hintWord, count: Math.max(1, Math.min(hintCount, secretWords.length)) };
  } catch (error) {
    console.error('DeepSeek API error:', error);
    // Fallback: generate a simple hint
    return generateFallbackHint(secretWords, round);
  }
}

function generateFallbackHint(secretWords: string[], round: number): { word: string; count: number } {
  // Simple fallback hints based on word categories
  const categories = [
    { words: ['океан', 'река', 'озеро', 'водопад', 'берег'], hint: 'вода' },
    { words: ['тигр', 'лев', 'волк', 'лиса', 'медведь'], hint: 'хищник' },
    { words: ['яблоко', 'банан', 'арбуз', 'вино'], hint: 'плод' },
    { words: ['гитара', 'скрипка', 'пианино', 'барабан'], hint: 'инструмент' },
    { words: ['планета', 'звезда', 'луна', 'комета'], hint: 'космос' },
    { words: ['замок', 'башня', 'мост', 'тоннель'], hint: 'строение' },
    { words: ['пират', 'рыцарь', 'ниндзя', 'самурай'], hint: 'воин' },
    { words: ['футбол', 'теннис', 'бокс', 'плавание'], hint: 'спорт' },
  ];

  // Find matching category
  for (const cat of categories) {
    const matching = secretWords.filter(w => cat.words.includes(w));
    if (matching.length >= 2) {
      return { word: cat.hint, count: matching.length };
    }
  }

  // Default: use first word's category
  const hints = ['природа', 'предмет', 'явление', 'место', 'действие'];
  return { 
    word: hints[round % hints.length], 
    count: Math.min(2, secretWords.length) 
  };
}

export async function generateAIWords(count: number, apiKey: string): Promise<string[]> {
  if (!apiKey) return [];
  
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Генерируй ровно ${count} разных русских слов (одно слово каждое, без повторов). Ответь только списком слов через запятую, без пояснений.`
          }
        ],
        temperature: 0.9,
        max_tokens: 200,
      }),
    });

    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const words = content.split(/[,\n]+/).map((w: string) => w.trim().toLowerCase()).filter((w: string) => w.length > 0 && w.length < 20);
    return words.slice(0, count);
  } catch (error) {
    console.error('Failed to generate AI words:', error);
    return [];
  }
}
