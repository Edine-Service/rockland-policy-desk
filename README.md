# Rockland Policy Desk

Policy Desk is a free, static, evidence-grounded chatbot for Rockland's draft information-security policies. It runs in the browser without an API key and can be hosted on GitHub Pages or any static/worker host.

## Included knowledge base

- **24 draft policies:** ISMSP01 through ISMSP24
- **82 source pages** with absolute PDF page citations
- **1,202 searchable controls** extracted from `ISMS New - Draft.pdf`
- **12,000 evaluation questions:** 500 unique questions for every policy
- Evidence-only behavior: unsupported questions receive a clear “not found” response

The question bank is stored in `evals/policy-question-bank.jsonl`; its counts are recorded in `evals/manifest.json`.

## Run locally

Node.js 22 or newer is recommended.

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

## Publish free with GitHub Pages

1. Create a GitHub repository and upload this package.
2. Push the files to the `main` branch.
3. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. The included workflow publishes the `public` folder automatically after each push.

No API key or paid server is required for this static evidence-search version.

## Verify and build

```bash
npm test
npm run build
```

The deployable worker is generated in `dist/server/index.js`.

## How answers work

The browser searches policy IDs, titles, sections, topics, exact clause text, and security synonyms. It returns the strongest matching controls and displays the policy ID, PDF page, section, and exact excerpt. This is retrieval rather than a hosted AI model, so it stays free and does not send policy text to an external API.

The source is marked **Draft** throughout the interface. Verify critical decisions and final wording with Rockland Information Security.
