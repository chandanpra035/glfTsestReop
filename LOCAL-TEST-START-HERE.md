# GLF RESERVE — Safe Local End-to-End Test

**Never upload `local-settings.json` to GitHub or Vercel.** Do NOT run `vercel deploy`, commit secrets, or modify the existing production Google Script. The `index.html`, `welcome-kit/index.html`, images, and existing Vercel `api/` files are preserved from your uploaded ZIP. `local-server.js` intercepts those API paths ONLY on `127.0.0.1:5500`.

## Who does what?

- **Signup TEST Sheet** — `GLF Reserve - Local Signup TEST` in `adorbix.new@gmail.com`: date, IST time, email, country. Its independent script uses `GLF_TEST_SECRET`.
- **Test sender** — `chandanpra035@gmail.com`: standalone Apps Script sends a welcome email to a test email on the allowlist. It uses `GLF_MAIL_TEST_SECRET`. Does not need access to the Sheets.
- **Welcome Kit Members Sheet** — `GLF Reserve - Welcome Kit Members` in `adorbix.new@gmail.com`: name, verified email, fragrance, address, etc. Its existing independent script uses `GLF_API_SECRET`. **Test rows WILL be saved here**, so use dummy name/address; if you want absolutely no test rows here, duplicate this sheet and deploy a separate TEST Welcome Kit script before testing.
- **Original live signup / Sheet 1 (Akash)**: untouched. Its environment variables and original deployment are not used by this local server.

## 1. Prepare Local Signup TEST Apps Script

Open `GLF Reserve - Local Signup TEST` → Extensions → Apps Script, replace its *TEST* Code.gs with the supplied `TEST-SIGNUP-SHEET.gs`. Keep its `GLF_TEST_SECRET` Script Property value. Make sure its tab is named `Sheet1` (or change `TEST_SIGNUP_TAB`). **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**, and retain the `/exec` URL. This revision adds duplicate detection: the same email will not get a second test welcome email.

## 2. Prepare Chandan TEST Email Apps Script

On Google Apps Script in `chandanpra035@gmail.com`, open the separate test email project and replace its code with `CHANDAN-EMAIL-TEST.gs`. Under Project Settings → Script Properties add `GLF_MAIL_TEST_SECRET` with a long random string. In `allowed` inside the code, include ONLY test email addresses you own / have permission to send to. **Deploy → New deployment → Web app → Execute as Me → Who has access Anyone → Deploy** (or edit existing deployment to a *new version*). Copy its `/exec` URL.

**Do not paste the mail script into either Sheet script.** Chandan's test mailbox sends emails; it does not store rows.

## 3. Welcome Kit Members script

Use the already-deployed `/exec` URL of `GLF Reserve - Welcome Kit Members`. Ensure `GLF_API_SECRET` matches its Script Property. The Script `Code.gs` must accept `name,email,fragrance,address,city,state,postal,country,secret` JSON and reply `{"success":true}` after saving. Its tab name should be `Sheet1` or whatever is set there. If using the existing script from the earlier setup, no new script is needed.

## 4. Local-only settings

Copy `local-settings.example.json` → `local-settings.json`. Enter 3 **different** `/exec` URLs and the corresponding script secrets, plus an unrelated `tokenSecret` (minimum 32 chars). Set `allowedTestRecipients` to your own test inbox(es), **exactly the same allowlist used in the Chandan script**. Do not share the filled settings file or screenshot its secrets.

## 5. Start locally

Install Node.js 18+ if needed. In VS Code terminal, from the extracted ZIP folder:

```sh
node local-server.js
```

Open **http://127.0.0.1:5500/**. Do **not** use VS Code Live Server for this test; Live Server cannot execute these private server APIs. This project uses no third-party npm packages.

## 6. End-to-end test

1. Enter an allowlisted email address (start with `chandanpra035@gmail.com`) in **Join the Reserve**.
2. Check a row was added to `GLF Reserve - Local Signup TEST` (not the production signup Sheet).
3. Check that email's inbox for `Welcome to GLF RESERVE — TEST` sent by Chandan Gmail.
4. On the SAME COMPUTER, click **CHOOSE YOUR FRAGRANCE**. `http://127.0.0.1:5500/welcome-kit/?token=...` opens with email automatically filled and readonly.
5. Enter a dummy name, select any of four fragrance cards, fill a dummy shipping address and press **CONFIRM MY FRAGRANCE & ADDRESS**.
6. Check the new row in `GLF Reserve - Welcome Kit Members` under `adorbix.new@gmail.com`.

**To test signup again with the same email:** the test script returns `alreadyJoined`; it will not resend. Clear your *test* row or use another allowlisted test address (add it to both allowlists).

## If email link does not work

The email link uses the same computer's `127.0.0.1:5500`; keep `node local-server.js` running. Don't open it on your mobile phone or another computer. Sending provider may wrap a local link; copy it to your local browser if needed. This is local-only testing, not a public customer link.

## Important limitations

- This is **TEST ONLY**. Never use real customer emails/addresses without permission or put secrets in browser JS.
- It is not automatic production deployment. Nothing is uploaded to GitHub / Vercel by running this code.
- Once verified, a **separate** production rollout needs authorized `member@glfreserve.com` sender, public HTTPS form link, and configuration under Vercel.
- Google Apps Script `Anyone` exposes a URL but not Sheet viewer access; the server sends a private shared secret. Protect credentials and keep each Sheet restricted.
- One-time claim/anti-abuse handling for real gifts should be added before production.
