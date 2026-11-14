# BinSight: 5-minute demo script

**Before judging:** laptop on the venue Wi-Fi, app open at least once (model cached), phone and laptop charged.
Props on the table: coffee cup with lid, pizza box, pop can, chip bag, battery (AA), banana peel. Faculty set on the Impact tab.
Sound on (speaker button, top right) only if the room is quiet enough.

| Time | What we do | What we say |
|---|---|---|
| **0:00–0:30** | Point the phone at the **coffee cup**, tap the shutter. The blue-bag card drops in. | "Show it working first: this is a coffee cup, and in Edmonton homes it goes in the **blue bag**, lid off and in recycling separately. That changed six weeks ago, on Oct 1, 2026. Most apps and chatbots still say garbage." |
| **0:30–1:30** | Scan the **pizza box** → "Is there grease or food stuck to it?" Tap **Yes** → black cart. Back, **No** → blue bag. Then scan the **pop can**. | "Like a knowledgeable person, it asks one quick question when the rule depends on condition. And the pop can isn't just 'recycling': it's 10¢ back at the **bottle depot**." |
| **1:30–2:30** | Scan the **chip bag** or something ambiguous so the **"Which one is it?"** picker appears. Flip **Home → Campus** on the coffee cup result. | "If it isn't sure, or its top two guesses go in different bins, it asks. A wrong bin is worse than one tap. Flip to **Campus** and the same cup goes to **Landfill**, because UofA's bins follow institutional rules, not the new residential ones." |
| **2:30–3:30** | Open **Impact**: personal tally, CO₂e estimate, faculty leaderboard filling with the scans we just did. | "Every correct sort counts toward your faculty. CO₂e uses the US EPA's WARM factors and only items we have a cited weight for, so it's an underestimate. The leaderboard started empty this morning: no fake data." |
| **3:30–4:30** | Open **About**: pipeline, measured accuracy, confusion matrix. **Turn Wi-Fi off**, go back, scan the banana peel. | "We measured it: here's the accuracy and the confusion matrix from our eval harness. The model runs on the phone: the photo never leaves it. And it works offline. Wi-Fi's off, still sorting." |
| **4:30–5:00** | — | "Next: venue-photo tuning per item with a few reference shots, more cities as data files, and putting it on the Zero Waste Stations as a QR code." |

## Likely judge questions

**How accurate is it?**
Show the About screen. The numbers come from `npm run eval` (eval/REPORT.md): top-1, top-3, bin-level accuracy, and a threshold sweep. Be honest about which photo set they came from (see the label on the About screen).

**Did you train a model?**
No. It's zero-shot CLIP (OpenAI, MIT licence) running in the browser via Transformers.js. We wrote the item vocabulary and prompts, precomputed the text embeddings, built the decision logic, and tuned the threshold and temperature on our eval set.

**Where do the rules come from?**
City of Edmonton pages (Recycling, Food Scraps, Curbside, Eco Stations, EPR) and the UofA Zero Waste cheat sheet. Every rule in `shared/src/rules/rules.ts` cites its source, and the app shows the link on every answer.

**What if it's wrong?**
It's designed to ask rather than guess: low confidence, or top guesses that map to different bins, shows a one-tap picker. "Not right?" is on every result, and typing always works. Items the City doesn't clearly cover say "Check before you toss" instead of guessing.

**Does my photo get uploaded?**
No. The model runs on the device. The leaderboard only receives `{ faculty, itemId, destination }`.

**How much did AI write?**
We used Claude Code as a pair programmer. The rules data was researched from the official pages and every rule cites one; the rules engine, decision logic, eval harness, server and UI are our own design, with 250+ unit tests, a blind holdout test suite and Playwright end-to-end tests. We can walk you through any file.
