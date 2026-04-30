// Vercel Serverless Function — проксі до Groq API
//
// Приймає запит від мобільного застосунку, додає API ключ із змінних оточення
// і пересилає на Groq. Ключ ніколи не покидає сервер.
//
// URL після деплою: https://YOUR-PROJECT.vercel.app/api/chat

// Простий in-memory rate limiter (на одну serverless instance)
// Захищає від зловживань — не більше 30 запитів на IP за годину
const rateLimitMap = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 година

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.firstHit > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstHit: now });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Валідація запиту від клієнта
function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return 'Invalid request body';
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return 'messages must be a non-empty array';
  }
  // Обмежуємо довжину запиту, щоб ніхто не сипав мегабайти
  const totalChars = body.messages.reduce((s, m) => s + (m.content?.length || 0), 0);
  if (totalChars > 50000) {
    return 'Request too large';
  }
  return null;
}

export default async function handler(req, res) {
  // CORS — щоб мобільне застосування могло звертатись з будь-якого пристрою
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting по IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                   req.headers['x-real-ip'] ||
                   'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: { message: 'Перевищено ліміт запитів. Спробуйте через годину.' }
    });
  }

  // Перевірка ключа на сервері
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: { message: 'Server configuration error: API key not set' }
    });
  }

  // Валідація тіла запиту
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json({ error: { message: validationError } });
  }

  try {
    // Пересилаємо запит у Groq, додавши ключ
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.body.model || 'llama-3.3-70b-versatile',
        temperature: req.body.temperature ?? 0.5,
        max_tokens: Math.min(req.body.max_tokens || 1024, 2048), // обмеження
        messages: req.body.messages,
      }),
    });

    const data = await groqResponse.json();

    // Прокидаємо статус-код Groq назад клієнту
    return res.status(groqResponse.status).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(502).json({
      error: { message: 'Failed to reach AI service. Try again later.' }
    });
  }
}
