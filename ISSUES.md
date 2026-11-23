# Issues

Every problem Fenny has hit so far, what caused it, and how it was fixed. Grouped by area, newest first in each group. Last updated 23 November 2026.

Status key: **Fixed** means the fix is merged and live. **Fixed, needs app build** means the fix is merged but only reaches phones after a new TestFlight build. **Open** means it still needs doing.

## Still open

These are the things that still need action today.

| What | Why it matters | What it needs |
|---|---|---|
| New TestFlight build running (started 23 November, 9:11) | The last TestFlight build is from 7 November. Adding PDF, PowerPoint and Word notes (21 November) added a new piece of phone code, so small updates no longer reach the old build. The blank picture fix and the design changes from 21 November are waiting behind it. | Edem presses **Run workflow** on [iOS to TestFlight](https://github.com/EmotiveImpact/Feynman-voice-app/actions/workflows/ios-testflight.yml). About 35 minutes, then update Fenny in TestFlight. |
| Lesson catalogue not connected to the database | Saving and reusing lessons (PR [#70](https://github.com/EmotiveImpact/Feynman-voice-app/pull/70)) is built but sleeping, because the server has no database login yet. Lessons work as before in the meantime. | Edem says "yes, connect the database". |
| Website waitlist table never created | The database had no tables at all before 21 November, so the website's waitlist table was never made. The website itself is not live at a domain yet either. | Create the table and put the website live when Edem is ready. |
| OpenAI spare has no credit | When Claude fails, Fenny switches to OpenAI, but that account has no credit, so the spare does not really help. Edem chose Claude as the main brain on 19 November. | Nothing unless Edem wants a working spare. |
| Production gaps before a public launch | One shared access token and no rate limit, no accounts, no minutes cap on the server, no payments, no privacy page or account deletion, the app id still says prototype, no crash reports. | Waiting on Edem's go. Suggested first: accounts and a minutes cap. |

## Server, AI keys and the live service

### "Server returned 500" on everything
- **Date:** 21 November 2026
- **What you saw:** lessons, calls and everything else failed with "Server returned 500".
- **Cause:** the new file reader for PDF, PowerPoint and Word notes brought in a line of code that clashed with an identical line the server already had. The server crashed the moment it started.
- **Fix:** renamed the clashing line. Server came back within minutes.
- **PR:** [#67](https://github.com/EmotiveImpact/Feynman-voice-app/pull/67)
- **Status:** Fixed

### Lessons and speaking failing: wrong Claude key on Vercel
- **Date:** 21 November 2026 (first seen 8 November)
- **What you saw:** lessons would not load and Fenny would not speak, even after making new Claude keys and seeing charges.
- **Cause:** the live server on Vercel still had the dead Claude key from 6 November. The new keys were going into the Claude cloud settings (used by Claude while building), not into Vercel. When Claude refused the old key, the server switched to OpenAI, which had no credit, so both failed.
- **Fix:** Edem saved a fresh key in Vercel's ANTHROPIC_API_KEY setting (now on all environments) and the server was redeployed. Lessons load again.
- **PR:** none, a settings change
- **Status:** Fixed

### Calls failed outright when Claude's key failed
- **Date:** 19 November 2026
- **What you saw:** live calls, the after-call review, camera looks and note reading stopped working when the Claude account hit its limit.
- **Cause:** only lessons had a backup. Everything else had no plan B.
- **Fix:** every feature now tries OpenAI when Claude fails, and remembers the trouble for five minutes so each turn does not wait on a call that will fail.
- **PR:** [#58](https://github.com/EmotiveImpact/Feynman-voice-app/pull/58)
- **Status:** Fixed (but see "OpenAI spare has no credit" above)

### Claude account at its spend limit
- **Date:** 19 November 2026
- **What you saw:** nothing worked after a ten day break.
- **Cause:** the Claude account had reached its monthly spend limit, and OpenAI was out of credit.
- **Fix:** Edem raised the Claude spend limit.
- **PR:** none
- **Status:** Fixed

### "The lesson didn't load" in build 13
- **Date:** 6 November 2026
- **What you saw:** Teach me showed "The lesson didn't load".
- **Cause:** the Claude key on the server was refused.
- **Fix:** lessons fall back to OpenAI when Claude fails. The lesson error screen also got a Back to the call button so you are never stuck.
- **PR:** [#32](https://github.com/EmotiveImpact/Feynman-voice-app/pull/32), [#33](https://github.com/EmotiveImpact/Feynman-voice-app/pull/33)
- **Status:** Fixed

## Deploys, builds and app updates

### Phones stopped getting small updates
- **Date:** 21 November 2026
- **What you saw:** fixes merged but not showing on the phone.
- **Cause:** adding files of notes needed a new piece of phone code (the file picker). Small over-the-air updates can only reach a TestFlight build that already has that code.
- **Fix:** needs one new TestFlight build. After that, small updates flow again.
- **PR:** [#66](https://github.com/EmotiveImpact/Feynman-voice-app/pull/66)
- **Status:** Open (see top)

### Server deploys failing on a Microsoft download
- **Date:** 6 and 19 November 2026, fixed 20 November
- **What you saw:** a merged change did not go live; the deploy failed.
- **Cause:** every install downloaded a large graphics card package from Microsoft's servers that Fenny never uses. When that download timed out, the whole deploy failed.
- **Fix:** the install now skips that download. Installs take about 18 seconds.
- **PR:** [#65](https://github.com/EmotiveImpact/Feynman-voice-app/pull/65)
- **Status:** Fixed

### GitHub Actions stopped running
- **Date:** 19 to 20 November 2026
- **What you saw:** "Update the app" and "iOS to TestFlight" did nothing; every job failed within two seconds with no log.
- **Cause:** a GitHub account and billing limit on the private repository.
- **Fix:** the repository was made public, which gives free Actions time. Jobs ran again from about 04:30 on 20 November.
- **PR:** none
- **Status:** Fixed

### Expo free builds used up
- **Date:** 6 November 2026
- **What you saw:** no more free iPhone builds on Expo.
- **Cause:** the free monthly Expo build allowance ran out.
- **Fix:** iPhone builds now run free on GitHub's Mac machines ("iOS to TestFlight", about 35 minutes). The first run could not find the Expo token, fixed by reading it from the right place.
- **PR:** [#36](https://github.com/EmotiveImpact/Feynman-voice-app/pull/36), [#37](https://github.com/EmotiveImpact/Feynman-voice-app/pull/37)
- **Status:** Fixed

### "Update the app" first runs failed
- **Date:** 8 November 2026
- **What you saw:** the automatic app update failed.
- **Cause:** the voice model file is not stored in the code, so the update could not find it.
- **Fix:** the update fetches the model first. It also now runs by itself on every merge, so nobody has to press it.
- **PR:** [#55](https://github.com/EmotiveImpact/Feynman-voice-app/pull/55), [#56](https://github.com/EmotiveImpact/Feynman-voice-app/pull/56)
- **Status:** Fixed

### Too many deploys in a day
- **Date:** 6 November 2026
- **What you saw:** Vercel refused new deploys late in the evening.
- **Cause:** the free plan allows 100 deploys a day, and a busy day of merges hit it.
- **Fix:** waited for the limit to reset (by 01:00 the next day). Old deploys can be cleared with a clean-up script on the Mac.
- **PR:** none
- **Status:** Fixed

### iPhone build would not compile or install
- **Date:** 5 November 2026
- **What you saw:** the first TestFlight builds failed.
- **Cause:** several setup faults: the Phonon voice module was hidden by a file rule and never saved; the ONNX voice engine looked for its files in the wrong folder and used code React Native 0.88 no longer has; two copies of React were installed; the server install could not find the patching tool.
- **Fix:** saved the module, pointed the engine at the right folder, patched it for the new React Native, used one copy of React, and installed the patching tool on the server too.
- **PR:** [#5](https://github.com/EmotiveImpact/Feynman-voice-app/pull/5), [#6](https://github.com/EmotiveImpact/Feynman-voice-app/pull/6)
- **Status:** Fixed

### First automatic checks failed
- **Date:** 3 November 2026
- **What you saw:** the code checks failed on the first pull request.
- **Cause:** the checks needed a Python add-on to convert the Kitten voice file, and could not see it.
- **Fix:** the conversion now runs without Python.
- **PR:** [#3](https://github.com/EmotiveImpact/Feynman-voice-app/pull/3)
- **Status:** Fixed

## Teach me lessons and drawings

### Lesson pictures looked the same every time and never built up
- **Date:** 23 November 2026
- **What you saw:** in real lessons the pictures felt like the same thing over and over, and each picture started from scratch instead of building on the last.
- **Cause:** the lesson writer reached for the same "box with arrows in and out" picture in 6 of 10 lessons, often for ideas that are not machines at all ("Your mind", "The economy"). A rule said never use the same kind of picture twice, so every bite jumped to a new, unrelated chart and the people and things that can walk from one picture to the next were rarely used. One lesson even drew the same graph twice.
- **Fix:** the writer now plans one story that builds. Every lesson shows someone or something real, each picture keeps at least one named thing from the one before (people walk on to the next moment), the box picture is a last resort used at most once, and the same picture twice is refused. Lessons that break this are rewritten once. Tested on 10 real lessons across subjects: lessons using the box picture 6 to 1, lessons with a real person or thing 6 to 10, lessons where the pictures carry something on 5 to 10. Pictures also carry on in the non-voice lesson view on the phone.
- **PR:** see the pull request "Teach me pictures: one story that builds"
- **Status:** Fixed on the server. The phone part arrives after the new TestFlight build.

### Simpler turned a lesson into a different topic
- **Date:** 21 November 2026
- **What you saw:** pressing Simpler on a lesson about a control panel gave a lesson about a lift, with a puzzle "What happens after you press? Lift moves / Nothing".
- **Cause:** the simplest level told the AI to use an everyday comparison in every step and no technical words at all, so it swapped the subject for the comparison.
- **Fix:** Simpler now means the same topic in plainer words. At most one comparison per lesson, always tied back, never in the title, drawing or puzzle. Every lesson is checked for drifting off topic and remade if it does. Tested: 8 of 14 on topic before, 21 of 21 after.
- **PR:** [#69](https://github.com/EmotiveImpact/Feynman-voice-app/pull/69)
- **Status:** Fixed

### Blank picture box during a guess
- **Date:** 21 November 2026
- **What you saw:** an empty drawing panel while Fenny asked a guess like "Will the lamp light?".
- **Cause:** a timing fault. The question appeared before the picture had been drawn in.
- **Fix:** the whole picture now appears first, still and unlit, then Fenny asks. If a picture ever fails to draw, a simple diagram shows instead of an empty box.
- **PR:** [#68](https://github.com/EmotiveImpact/Feynman-voice-app/pull/68)
- **Status:** Fixed, needs app build

### Drawings not showing at all; lesson screen bouncing
- **Date:** 7 November 2026
- **What you saw:** the drawing panel stayed blank on the phone, and pulling the puzzle screen made it bounce as if it would reset.
- **Cause:** the drawing code runs on a separate fast lane on the phone, which needs every helper written before the code that uses it. Several were in the wrong order, so drawings failed silently.
- **Fix:** put the helpers in order, added a test that keeps them in order, and stopped the bounce.
- **PR:** [#53](https://github.com/EmotiveImpact/Feynman-voice-app/pull/53)
- **Status:** Fixed

### App closed when a Teach me lesson opened
- **Date:** 7 November 2026
- **What you saw:** the app shut while a lesson was being made.
- **Cause:** opening Teach me turns the mic off, which makes the iPhone reset its sound. At that moment three parts of the app touched the Phonon voice at once, and the clash closed the app.
- **Fix:** voice actions now happen one at a time and each is guarded, so a clash skips a sentence instead of closing the app. A lesson that breaks shows "The lesson hit a snag" with a way back. The voice also now loads on launch, so "Preparing the voice" is rarely seen.
- **PR:** [#50](https://github.com/EmotiveImpact/Feynman-voice-app/pull/50)
- **Status:** Fixed

### Teach me lessons were silent
- **Date:** 6 November 2026
- **What you saw:** lessons played but Fenny did not read them aloud.
- **Cause:** when the mic closed for Teach me, the iPhone stopped the Phonon voice and it never started again.
- **Fix:** Phonon restarts itself when the iPhone stops it.
- **PR:** [#40](https://github.com/EmotiveImpact/Feynman-voice-app/pull/40)
- **Status:** Fixed

### Match puzzles with repeated cards
- **Date:** 6 November 2026
- **What you saw:** match puzzles with two identical cards, which could not be solved properly.
- **Cause:** the AI sometimes wrote the same card twice.
- **Fix:** such puzzles are rejected and remade.
- **PR:** [#44](https://github.com/EmotiveImpact/Feynman-voice-app/pull/44)
- **Status:** Fixed

### Lone drawings felt useless
- **Date:** 19 November 2026
- **What you saw:** drawings were single objects that did not explain much.
- **Cause:** the drawing set was a fixed library of things, not stories.
- **Fix:** a full kit of parts (posable people, places, scenes, maps, time, words) for every subject, then movement between and within pictures.
- **PR:** [#59](https://github.com/EmotiveImpact/Feynman-voice-app/pull/59), [#60](https://github.com/EmotiveImpact/Feynman-voice-app/pull/60), [#62](https://github.com/EmotiveImpact/Feynman-voice-app/pull/62), [#63](https://github.com/EmotiveImpact/Feynman-voice-app/pull/63), [#64](https://github.com/EmotiveImpact/Feynman-voice-app/pull/64)
- **Status:** Fixed

## Calls, microphone and voice

### Fenny's replies cut off after a split second
- **Date:** 6 November 2026
- **What you saw:** Fenny started a reply, stopped almost at once and jumped to the next question.
- **Cause:** on the louder speaker the mic heard Fenny's own voice and treated it as you carrying on talking.
- **Fix:** the mic is ignored while Fenny speaks and for a moment after. To cut in, tap the button.
- **PR:** [#27](https://github.com/EmotiveImpact/Feynman-voice-app/pull/27)
- **Status:** Fixed

### Voice very faint
- **Date:** 6 November 2026 (build 10)
- **What you saw:** Fenny was hard to hear.
- **Cause:** the iPhone sound mode used for calls kept the volume low.
- **Fix:** switched to a louder sound mode and forced the loudspeaker.
- **PR:** [#23](https://github.com/EmotiveImpact/Feynman-voice-app/pull/23), [#27](https://github.com/EmotiveImpact/Feynman-voice-app/pull/27)
- **Status:** Fixed

### Fenny jumped in when you paused mid-thought
- **Date:** 6 November 2026
- **What you saw:** a short pause to think ended your turn.
- **Cause:** the turn ended after 1.2 seconds of quiet.
- **Fix:** Fenny waits 2 seconds (3 after a why or how question), carrying on soon after counts as the same turn, and the server can choose to keep waiting.
- **PR:** [#22](https://github.com/EmotiveImpact/Feynman-voice-app/pull/22), [#23](https://github.com/EmotiveImpact/Feynman-voice-app/pull/23), [#24](https://github.com/EmotiveImpact/Feynman-voice-app/pull/24)
- **Status:** Fixed

### Voice slowed down by mistake
- **Date:** 5 November 2026
- **What you saw:** the voice became slower.
- **Cause:** "the voice is super quick!" was read as a complaint when it was praise.
- **Fix:** put the voice back to its normal pace.
- **PR:** [#16](https://github.com/EmotiveImpact/Feynman-voice-app/pull/16)
- **Status:** Fixed

### Call went deaf after the first reply
- **Date:** 5 November 2026 (builds 7 and 8)
- **What you saw:** the call stopped listening after your first answer.
- **Cause:** two faults. The sound library switched the iPhone's sound off after each reply clip, and the iPhone stops the mic whenever the sound route changes, which never restarted.
- **Fix:** the mic stays counted as in use, rebuilds itself after a sound change, reopens once if it stops for good, and keeps a turn already sent. The mic is never left open after a call.
- **PR:** [#9](https://github.com/EmotiveImpact/Feynman-voice-app/pull/9), [#12](https://github.com/EmotiveImpact/Feynman-voice-app/pull/12), [#13](https://github.com/EmotiveImpact/Feynman-voice-app/pull/13)
- **Status:** Fixed

### No sound at all in the first TestFlight build
- **Date:** 5 November 2026 (build 5)
- **What you saw:** silence when Fenny spoke.
- **Cause:** the sound library set the iPhone to record only while the mic was open.
- **Fix:** patched it to play and record at the same time through the loudspeaker.
- **PR:** [#7](https://github.com/EmotiveImpact/Feynman-voice-app/pull/7)
- **Status:** Fixed

## Fenny's conversation

### Fenny sounded scripted and kept saying "Ooh"
- **Date:** 7 November 2026
- **What you saw:** the same Teach me offer word for word, every call opening "Ooh, OK", and other fixed lines.
- **Cause:** several lines were written once and repeated.
- **Fix:** Fenny words its own lines, fresh each time, and never says "Ooh". The Teach me offer is made at most twice. Repeats fell from 16% to 0%.
- **PR:** [#51](https://github.com/EmotiveImpact/Feynman-voice-app/pull/51)
- **Status:** Fixed

### Fenny kept asking when you said you didn't know
- **Date:** 6 November 2026
- **What you saw:** more questions after "I don't know".
- **Fix:** Fenny stops asking straight away and offers Teach me.
- **PR:** [#24](https://github.com/EmotiveImpact/Feynman-voice-app/pull/24)
- **Status:** Fixed

### Dashes and symbols read aloud
- **Date:** 6 November 2026
- **What you saw:** odd pauses or symbols spoken.
- **Fix:** everything Fenny says is cleaned of dashes and symbols before it is spoken.
- **PR:** [#21](https://github.com/EmotiveImpact/Feynman-voice-app/pull/21)
- **Status:** Fixed

### Vague "what bit?" questions
- **Date:** 5 November 2026
- **What you saw:** after a rules change, Fenny asked vague questions and opened with "which bit will be hardest?".
- **Fix:** vague and meta questions are banned, questions stay on the subject, and the old opener is back.
- **PR:** [#18](https://github.com/EmotiveImpact/Feynman-voice-app/pull/18)
- **Status:** Fixed

## App screens

### Screens felt cluttered and hard to get around
- **Date:** 21 November 2026
- **What you saw:** text running under the top bar, no back button on the topic page, mismatched title sizes, settings mixed into Me, "coming soon" items, the intro's gap cards missing.
- **Fix:** round back button on the topic page, Settings as its own page, gap cards on Today, paste notes working.
- **PR:** [#61](https://github.com/EmotiveImpact/Feynman-voice-app/pull/61)
- **Status:** Fixed, needs app build

### Fenny's face played catch-up after a screen change
- **Date:** 7 November 2026
- **What you saw:** Fenny raced through missed animation when you came back to a screen. The smiling face also had a hard line across it.
- **Fix:** animation picks up where it is, and the smile is drawn cleanly.
- **PR:** [#52](https://github.com/EmotiveImpact/Feynman-voice-app/pull/52)
- **Status:** Fixed

### View switch in the call screen
- **Date:** 6 November 2026
- **What you saw:** the view switch kept appearing in the call screen.
- **Fix:** it lives only in Settings.
- **PR:** [#27](https://github.com/EmotiveImpact/Feynman-voice-app/pull/27)
- **Status:** Fixed

### Review cards came back after a session
- **Date:** 4 November 2026
- **What you saw:** answered review cards reappeared, the voice kept going after End, and buttons fell off short screens.
- **Fix:** review progress is kept, End stops everything, and cards fit the screen.
- **PR:** [#2](https://github.com/EmotiveImpact/Feynman-voice-app/pull/2)
- **Status:** Fixed

## Website

### Mobile layout faults
- **Date:** 5 November 2026
- **What you saw:** the questions heading pushed off screen, the hero glow causing sideways scrolling, an oversized phone on mobile.
- **Fix:** all corrected before the website was merged.
- **PR:** [#49](https://github.com/EmotiveImpact/Feynman-voice-app/pull/49)
- **Status:** Fixed (website not live at a domain yet)
