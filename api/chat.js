const rateLimitMap = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.firstHit > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstHit: now });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // ===== ДІАГНОСТИКА: GET /api/chat?debug=1 показує, як виглядає ключ =====
  if (req.method === 'GET' && req.query.debug === '1') {
    const k = process.env.GROQ_API_KEY;
    return res.status(200).json({
      keyExists: !!k,
      keyLength: k ? k.length : 0,
      keyStart: k ? k.substring(0, 8) : null,
      keyEnd: k ? k.substring(k.length - 4) : null,
      hasLeadingSpace: k ? k !== k.trimStart() : null,
      hasTrailingSpace: k ? k !== k.trimEnd() : null,
      hasNewline: k ? k.includes('\n') || k.includes('\r') : null,
      env: process.env.VERCEL_ENV,
    });
  }
  // ====================================================================

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                   req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: { message: 'Rate limit exceeded' } });
  }

  // Беремо ключ і чистимо його від випадкових пробілів/переносів
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      error: { message: 'Server configuration error: API key not set' }
    });
  }

  if (!req.body || !Array.isArray(req.body.messages)) {
    return res.status(400).json({ error: { message: 'Invalid messages' } });
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.body.model || 'llama-3.3-70b-versatile',
        temperature: req.body.temperature ?? 0.5,
        max_tokens: Math.min(req.body.max_tokens || 1024, 2048),
        messages: req.body.messages,
      }),
    });

    const data = await groqResponse.json();
    return res.status(groqResponse.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(502).json({
      error: { message: 'Failed to reach AI service' }
    });
  }
}
