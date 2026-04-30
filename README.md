# Finance App — AI Proxy

Серверлесс-проксі для безпечного звернення до Groq API із мобільного застосунку.

## Як працює

```
[Flutter app] ──HTTPS──→ [Vercel proxy] ──Groq API key──→ [Groq Cloud]
```

API ключ зберігається на сервері Vercel у захищених environment variables.
Користувачі застосунку **не бачать ключ** — звертаються анонімно.

## Деплой за 5 хвилин

### 1. Зареєструйтесь на Vercel

https://vercel.com/signup → увійти через GitHub (це безкоштовно)

### 2. Залийте цю папку у новий репозиторій GitHub

Найпростіше — через веб-інтерфейс GitHub:
1. https://github.com/new → створіть репозиторій (приклад: `finance-app-proxy`)
2. Завантажте всі файли з цієї папки (`api/`, `vercel.json`, `package.json`, `README.md`)

### 3. Імпортуйте репозиторій у Vercel

1. https://vercel.com/new
2. Виберіть створений репозиторій
3. Натисніть **Deploy** (Vercel сам зрозуміє конфіг)

### 4. Додайте API ключ

Після першого деплою:
1. У Vercel: ваш проект → **Settings → Environment Variables**
2. Додайте:
   - **Name:** `GROQ_API_KEY`
   - **Value:** ваш Groq ключ (`gsk_...`)
   - **Environment:** Production, Preview, Development (всі три)
3. Натисніть **Save**

### 5. Передеплойте з оновленим ключем

У Vercel: ваш проект → **Deployments** → ⋯ біля останнього → **Redeploy**

### 6. Скопіюйте URL вашого деплоя

Виглядає як: `https://finance-app-proxy-xyz.vercel.app`

Цей URL потрібно прописати у мобільному застосунку:
- Файл `lib/data/remote/ai_assistant_service.dart`
- Замініть `YOUR_PROXY_URL` на ваш реальний URL

## Тест

Після деплою можете перевірити з консолі:

```bash
curl -X POST https://YOUR-PROJECT.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Привіт!"}
    ]
  }'
```

Має повернути JSON з відповіддю від Llama.

## Безпека

- ✅ Ключ Groq зберігається у Vercel env vars (зашифровано)
- ✅ Rate limiting: 30 запитів на IP/годину
- ✅ Обмеження розміру запиту (50k символів)
- ✅ CORS дозволено для мобільних клієнтів
- ✅ Безкоштовний tier Vercel: 100k запитів/місяць

## Якщо хтось зловживає

У Vercel у вкладці **Logs** видно всі запити з IP. Якщо помітите підозрілий трафік:
1. Тимчасово видаліть змінну `GROQ_API_KEY` — застосунок поверне помилку всім
2. Або оновіть ключ Groq і поверніть новий

## Структура

```
finance_app_proxy/
├── api/
│   └── chat.js          # Серверлесс-функція проксі
├── vercel.json          # Конфіг Vercel
├── package.json         # Метадані
└── README.md
```
