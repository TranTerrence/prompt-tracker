# I-BE³ Companion: Chrome Web Store listing (EN)

## Summary (max 132 chars)
A thoughtful pause before your AI prompts: a Socratic dialogue to think for yourself. ChatGPT, Claude, Gemini, Mistral, Grok.

## Description
Like the apps that help you unglue from your phone, **I-BE³ Companion** adds a little friction, and a lot of thinking, before your AI prompts.

🪞 **The Socratic mirror**
When your request is too vague ("do my homework"), sending is held BEFORE it reaches the AI. A dialogue opens, one question at a time: what have you tried? what's your hypothesis? how will you verify? Once you have covered the essentials, the dialogue hands back on its own — it does not chain endless questions at you — and you can always ask for one more. YOU always decide: send your version enriched with your reasoning, or your original request as is.

📚 **Your school's library (optional)**
If your institution publishes a selection of prompts, it appears collapsed inside the dialogue: "start from a prompt that worked". The extension only READS the page your school publishes — without sending your account, your prompts or any identifier — and asks your permission to reach it at the moment you enable it. You may decline: nothing else changes.

🪞 **The second look**
Once the AI's answer arrives, a discreet invitation (never blocking, at most once per conversation): restate the gist in your own words, pick what you'll verify elsewhere. That's where critical thinking is built.

📈 **Your progress, honestly measured**
Every prompt is scored locally, with a live breakdown (clarity, context, critical eye). The metric that matters: your FIRST DRAFTS, what you write on your own before any coaching. Day streaks, a threshold that rises as you improve, one-click CSV export. And the coach knows its place: it steps in when you open a topic, then lets you run your conversation ("Leave me alone on this thread" is always one click away).

🔒 **Data and privacy**
Nothing is recorded until you accept the disclosure screen shown on first launch: the extension stays inactive before your explicit consent.
• **Locally, after your consent**: quality scores, category, word count, site, date, outcome (sent, improved, cancelled), your dialogue answers and post-response reflections, plus measurements of the AI's answer — its length, its duration, the model used, and how long you take before sending the next prompt. The text of those answers is counted then forgotten: never recorded. The full text of your prompts is only recorded if you enable the dedicated setting. Everything stays on your computer: no account required.
• **Your account is created by the programme** (I-BE³ Companion), already attached to your organization: you link the extension by approving, in the app (companion.mines.paris/extension/pair), the pairing code shown in the popup. No password is ever typed into the extension. A second screen tells you exactly what will be shared (the indicators above, never any text) and you confirm with a button. Your account email identifies you to your programme.
• **Content** (prompt text, dialogues, reflections, conversation threads) is shared only if your organization requests it with a stated purpose AND you consent, category by category. Toggles off by default, revocable at any time; the server erases any non-consented content upon receipt.
• **Tailored AI questions (optional)**: if your organization enables it and you consented to sharing your text and reasoning, your prompt transits through Anthropic to generate the next question, without being stored.
• **Retention**: content erased after 90 days, indicators deleted after 12 months. Erase and export at any time. No selling, no advertising, no AI training.
Full policy: https://companion.mines.paris/extension/privacy

Who is it for?
• Students of the I-BE³ programme (Mines Paris - PSL): learn WITH AI without it thinking for you. The extension works on its own, without an account; the account, created by the programme, is what lets you share your progress with your CARE tutor.

Works on ChatGPT, Claude, Gemini, Mistral (Le Chat) and Grok, with Chrome and Chromium browsers on desktop. No iPhone/iPad or Android version at this stage (mobile browsers do not accept extensions).

## Single purpose
I-BE³ Companion helps the user improve the quality of their prompts on AI chat interfaces (ChatGPT, Claude, Gemini, Mistral, Grok): it makes them think before sending — showing proven prompts where useful — and reflects back the effect obtained.

> This sentence must stay **identical** to the one in `store/SUBMISSION.md`. Two different wordings in two files is a divergence that ends up in the form.

## Permissions justification
- `storage`: keep settings (theme, threshold, profile), the disclosure acceptance and prompt indicators (scores, categories) locally, only after the disclosure screen is accepted.
- `alarms`: periodic sync of indicators for users who linked their programme account (optional); alarms are only armed after the disclosure is accepted.
- Host `https://chatgpt.com/*`: read the input field for local, pre-send scoring and display the reflection dialogue on ChatGPT.
- Host `https://chat.openai.com/*`: legacy ChatGPT domain, same use.
- Host `https://claude.ai/*`: same use on Claude.
- Host `https://gemini.google.com/*`: same use on Gemini.
- Host `https://chat.mistral.ai/*`: same use on Mistral (Le Chat).
- Host `https://grok.com/*`: same use on Grok.
- Host `https://companion.mines.paris/*` (**mandatory**, single origin): lets the extension announce its installation state (armed, linked, last sync, pending count) to the app's own page at `document_start` (`src/presence.js`), and read the app's own default prompt library (`GET /api/prompt-library`) when the user's institution has not published its own. No other page can detect the extension this way.
- **Optional** host `https://*/*`: **never granted at install**. An institution may publish a prompt library at its own address, which the extension cannot know in advance. Permission is therefore requested at runtime, for the **single origin** configured by the user's institution, and only after an explicit click from them. It is a read without identity: no cookie, no token, no parameter derived from the account. Declining degrades no other feature.
The input field content is analyzed locally, before sending; it is not transmitted to any server without the consents described above. The response area is observed to measure its length and duration and to read the model name: that text is counted then forgotten, neither stored nor transmitted.

## "Privacy practices" tab (Developer Console): checklist
Data types to declare:
- [x] **Personally identifiable information**: email address (identifies the student to their programme, only after pairing the account).
- [ ] **Authentication information**: **no** — no password passes through the extension since 1.0.0 (the fallback form was removed; code pairing on the app is the only entry).
- [x] **User activity**: interaction indicators on AI sites (quality scores, categories, word counts, outcomes, timestamps, response length and duration, model used, reading delay).
- [x] **Website content**: prompt text, Socratic dialogues, reflections, collected only with opt-in, category-by-category consent (must still be declared).

Certifications to check:
- [x] Data is not sold or transferred to third parties outside the approved use cases.
- [x] Data is not used or transferred for purposes unrelated to the item's single purpose.
- [x] Data is not used or transferred to determine creditworthiness or for lending purposes.

Privacy policy URL: https://companion.mines.paris/extension/privacy

## Reviewer note (submission "notes" field)
This version implements a two-level prominent disclosure, per the User Data Privacy policy:
1. **On first launch** (screenshot 1): a disclosure screen details the data recorded, its purpose, destination and retention, with a link to the privacy policy. The extension stays fully inactive (no collection, not even locally) until the user clicks "I accept and turn on I-BE³ Companion".
2. **When linking the account** (screenshot 5): a second screen enumerates the indicators that will be shared and requires explicit agreement ("Accept and enable sharing"). Content (text, dialogues, reflections) remains subject to a separate, category-by-category consent, off by default, enforced server-side (any non-consented content is erased upon receipt).
Retention: content 90 days, indicators 12 months (automatic server-side purge). Users can erase and export their data at any time.

## Privacy policy
https://companion.mines.paris/extension/privacy
