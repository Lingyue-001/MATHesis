# Netlify CText Proxy Setup (Required Manual Steps)

This project cannot complete Netlify account-side deployment automatically. You must finish the steps below.

## What this enables

- Keep frontend on GitHub Pages.
- Use Netlify Functions as CText proxy for JSON mode.

## Required manual steps (you must do these)

1. Log in to Netlify.
2. Create a new site from this GitHub repository (`Lingyue-001/MATHesis`) or connect existing site to this repo.
3. In Netlify deploy settings, ensure build command/publish are valid for this repo (current static output is `dist`).
4. Deploy the site once.
5. Open this URL in your browser (replace domain):
   - `https://<your-netlify-site>/.netlify/functions/ctext-searchtexts?if=gb&searchTerms=一&json=1`
6. Confirm the response is JSON (starts with `{` or `[`), not HTML.

If step 6 fails, frontend JSON mode will fail too.

## How to test on GitHub Pages frontend

Open your transcription page with:

`?ctextSource=json&ctextProxy=https://<your-netlify-site>&ctextDebug=1`

Example:

`https://lingyue-001.github.io/MATHesis/transcriptions/tei_hanshu/1a.html?ctextSource=json&ctextProxy=https://example-site.netlify.app&ctextDebug=1`

## Troubleshooting checklist

- Netlify function URL returns 404:
  - Site is not deployed from current repo branch, or function path is wrong.
- Function URL returns HTML:
  - You opened site page URL, not function endpoint URL.
- Frontend still shows unavailable:
  - Verify `ctextProxy` is exact Netlify site base URL (no trailing slash required).
  - Keep `ctextSource=json` in URL.
