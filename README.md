# ClauseAI — Contract Analyzer

An AI-powered contract analysis tool built with vanilla HTML, CSS, and JavaScript, using the Anthropic Claude API.

## Features

- **Upload contracts** — PDF, DOCX, or TXT
- **Inaccuracy detection** — highlights contradictions, missing clauses, and legal risks
- **AI suggestions** — actionable recommendations for each issue
- **Live AI chat** — ask Claude anything about the open contract
- **Archive sidebar** — switch between past contracts

## Project Structure

```
clauseai/
├── index.html       # Main app shell
├── src/
│   ├── styles.css   # All styles
│   └── app.js       # Logic + Anthropic API calls
└── README.md
```

## Getting Started

### 1. Add your API key

Open `src/app.js` and replace the placeholder at the top:

```js
const API_KEY = "YOUR_ANTHROPIC_API_KEY";
```

Get your key at https://console.anthropic.com

### 2. Open the app

Since this is a plain HTML project, just open `index.html` in your browser:

```bash
open index.html
# or on Windows:
start index.html
```

Or use the VS Code **Live Server** extension for hot-reload during development.

### 3. (Recommended) Use a local dev server

```bash
npx serve .
```

Then visit http://localhost:3000

## ⚠️ Important: API Key Security

This project calls the Anthropic API directly from the browser, which is fine for **local development and prototyping**.

For production, you should proxy requests through your own backend (Node.js, Python, etc.) so the API key is never exposed to end users.

Example backend route (Node/Express):

```js
app.post('/api/analyze', async (req, res) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req.body),
  });
  const data = await response.json();
  res.json(data);
});
```

## Next Steps

- [ ] Add real PDF text extraction (e.g. `pdf.js`)
- [ ] Connect to a backend for persistent contract storage
- [ ] Export analysis reports as DOCX or PDF
- [ ] Add user authentication
- [ ] Stream AI responses token-by-token

## Tech Stack

- **Frontend**: Vanilla HTML + CSS + JavaScript
- **AI**: Anthropic Claude (`claude-sonnet-4-20250514`)
- **Fonts**: DM Serif Display, DM Mono, Instrument Sans (Google Fonts)
