# Prompt Tracker : Chrome Web Store listing (EN)

## Summary (max 132 chars)
A thoughtful pause before your AI prompts: local Socratic dialogue on ChatGPT, Claude, Gemini, Mistral and Grok.

## Description
Like the apps that help you unglue from your phone, **Prompt Tracker** adds a little friction, and a lot of thinking, before your AI prompts.

🪞 **The Socratic mirror**
When your request is too vague ("do my homework"), sending is held BEFORE it reaches the AI. A dialogue opens, one question at a time: what have you tried? what's your hypothesis? how will you verify? Iterate as long as you like, then YOU always decide: send your version enriched with your reasoning, or your original request as is.

🪞 **The second look**
Once the AI's answer arrives, a discreet invitation (never blocking, at most once per conversation): restate the gist in your own words, pick what you'll verify elsewhere. That's where critical thinking is built.

📈 **Your progress, honestly measured**
Every prompt is scored locally, with a live breakdown (clarity, context, critical eye). The metric that matters: your FIRST DRAFTS, what you write on your own before any coaching. Day streaks, a threshold that rises as you improve, one-click CSV export. And the coach knows its place: it steps in when you open a topic, then lets you run your conversation ("Leave me alone on this thread" is always one click away).

🔒 **Data and privacy**
Nothing is recorded until you accept the disclosure screen shown on first launch: the extension stays inactive before your explicit consent.
• **Locally, after your consent**: quality scores, category, word count, site, date, outcome (sent, improved, cancelled), your dialogue answers and post-response reflections. The full text of your prompts is only recorded if you enable the dedicated setting. Everything stays on your computer: no account required.
• **If you join a class** (code provided by your school or company): a second screen tells you exactly what will be shared (the indicators above, never any text) and you confirm with a button. Your account email identifies you to the teacher.
• **Content** (prompt text, dialogues, reflections, conversation threads) is shared only if your organization requests it with a stated purpose AND you consent, category by category. Toggles off by default, revocable at any time; the server erases any non-consented content upon receipt.
• **Tailored AI questions (optional)**: if your organization enables it and you consented to sharing your text and reasoning, your prompt transits through Anthropic to generate the next question, without being stored.
• **Retention**: content erased after 90 days, indicators deleted after 12 months. Erase and export at any time. No selling, no advertising, no AI training.
Full policy: https://track-prompt.vercel.app/privacy

Who is it for?
• Students: learn WITH AI without it thinking for you
• Consultants: prompts that show your reasoning
• Companies: good practices, critical thinking and an answer to shadow IT

Works on ChatGPT, Claude, Gemini, Mistral (Le Chat) and Grok, with Chrome and Chromium browsers on desktop. No iPhone/iPad or Android version at this stage (mobile browsers do not accept extensions).

## Single purpose
Prompt Tracker locally analyzes the quality of prompts typed on AI sites (ChatGPT, Claude, Gemini, Mistral, Grok), offers an optional reflection dialogue before sending, and measures the user's progress.

## Permissions justification
- `storage`: keep settings (theme, threshold, profile), the disclosure acceptance and prompt indicators (scores, categories) locally, only after the disclosure screen is accepted.
- `alarms`: periodic sync of indicators for users who joined an organization space (optional); alarms are only armed after the disclosure is accepted.
- Host `https://chatgpt.com/*`: read the input field for local, pre-send scoring and display the reflection dialogue on ChatGPT.
- Host `https://chat.openai.com/*`: legacy ChatGPT domain, same use.
- Host `https://claude.ai/*`: same use on Claude.
- Host `https://gemini.google.com/*`: same use on Gemini.
- Host `https://chat.mistral.ai/*`: same use on Mistral (Le Chat).
- Host `https://grok.com/*`: same use on Grok.
The input field content is analyzed locally, before sending; it is not transmitted to any server without the consents described above.

## "Privacy practices" tab (Developer Console): checklist
Data types to declare:
- [x] **Personally identifiable information**: email address (optional account creation).
- [x] **Authentication information**: password (optional account authentication).
- [x] **User activity**: interaction indicators on AI sites (quality scores, categories, word counts, outcomes, timestamps).
- [x] **Website content**: prompt text, Socratic dialogues, reflections, collected only with opt-in, category-by-category consent (must still be declared).

Certifications to check:
- [x] Data is not sold or transferred to third parties outside the approved use cases.
- [x] Data is not used or transferred for purposes unrelated to the item's single purpose.
- [x] Data is not used or transferred to determine creditworthiness or for lending purposes.

Privacy policy URL: https://track-prompt.vercel.app/privacy

## Reviewer note (submission "notes" field)
This version implements a two-level prominent disclosure, per the User Data Privacy policy:
1. **On first launch** (screenshot 1): a disclosure screen details the data recorded, its purpose, destination and retention, with a link to the privacy policy. The extension stays fully inactive (no collection, not even locally) until the user clicks "I accept and turn on Prompt Tracker".
2. **When joining an organization** (screenshot 6): a second screen enumerates the indicators that will be shared and requires explicit agreement ("Join and share these indicators"). Content (text, dialogues, reflections) remains subject to a separate, category-by-category consent, off by default, enforced server-side (any non-consented content is erased upon receipt).
Retention: content 90 days, indicators 12 months (automatic server-side purge). Users can erase and export their data at any time.

## Privacy policy
https://track-prompt.vercel.app/privacy
