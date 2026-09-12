# JP Ebook Reader API

Small Node.js backend for the reader's AI explanation feature. It keeps the
OpenAI credential out of the browser and streams Responses API events to the
React app.

## Local development

```sh
cp .env.example .env
npm start
```

The service listens on `PORT` (default `8787`). Point the frontend at it with:

```sh
VITE_API_URL=http://localhost:8787
```

## Endpoints

- `GET /health`
- `POST /api/explain`

The production service expects `OPENAI_API_KEY` and should restrict
`ALLOWED_ORIGINS` to the deployed frontend origins.
