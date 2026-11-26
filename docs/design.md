# Winter Practice App: Design

*Status: draft for Kyla's approval · Nov 25, 2026*

## 1. What this is, and why

A small Duolingo-style practice app made only for Kyla's students. Over winter break, kids open a link, work through short self-checking lessons, and earn stars. When they come back, Kyla gives each kid a "treasure chest" in Pokémon Classroom holding the stars they earned, so they start the semester with money for the star shop.

**Why:** the grammar and phonics skills they built this semester fade over a long break. The app gives kids a fun reason to keep practicing the essentials, on their own or with a parent, without Kyla in the room.

**Later:** if it works, the same app will supplement homework during the school year (see §9).

**Who uses it:**
- **Students:** Snapdragon Grades 1–4. That's four classes, one per grade, with 53 kids: G1 12, G2 14, G3 13, G4 14. Grade 5 is not included. Many are young ESL learners, and most Grades 1–2 kids can't read instructions yet.
- **Parents:** they help younger kids open the app, usually on a phone.
- **Kyla:** checks who is practicing, and edits questions.

## 2. Goals, non-goals, anti-goals

**Goals**
- Kids practice the essential grammar skills (and phonics for Grades 1–2) a little at a time across the break.
- Logging in is as easy as possible for kids and parents.
- Kyla can see at a glance who is practicing, how much, and which skills they've covered.
- It looks polished and cute without being hokey. Kyla is picky about design.
- It's ready to test in class in the last two weeks of the semester (target: working by about Dec 10, 2026), so parent login problems surface before break, not during it.

**Non-goals**
- **Not an assessment.** Kids may answer with a parent's help, so scores aren't treated as data. The teacher view shows completion and practice, not grades.
- **No free writing.** Every question checks itself.
- **No streaks.** Missing a day costs nothing.
- **No anti-cheating.** Kyla isn't worried about kids farming stars.
- **No automatic link to Pokémon Classroom for stars.** Kyla adds the stars there herself.
- **No Pokémon artwork or names.** The art is copyrighted; the app has its own mascot.
- **No other teachers or classes in v1.**
- **No parent accounts.**

**Anti-goals** (it fails even if it technically works if…)
- It looks ugly, babyish, or like a template.
- Parents can't get their kid in, and Kyla ends up troubleshooting over break.
- Anything in it breaks or changes Pokémon Classroom.
- Kids feel punished for missing days or getting answers wrong.

## 3. Constraints

- **Hosting:** Vercel.
- **Data:** the Supabase project that Pokémon Classroom already uses. **New tables only.** Never alter, rename, or write to Pokémon Classroom's existing tables. The roster is imported from Kyla's student export into this app's own table (see §7.1).
- **Separate app:** its own repo and its own Vercel project, not a section inside Pokémon Classroom.
- **Kids are minors.** Store as little personal data as possible: display name, class, blob color, progress. No emails, birthdays, or photos.
- **Devices:** mostly parents' phones (Android and iPhone), some tablets. Design for phone first; the teacher side should work on a laptop.
- **Spelling:** American English throughout.
- **Approval:** none needed from the school or department head (Kyla confirmed).
- **Pokémon Classroom's access settings:** leave them as they are. This app adds no new exposure. If the builder finds that Pokémon Classroom's existing tables are more open than they should be, report it to Kyla as a separate issue; don't fix it inside this project.

## 4. Approaches considered

1. **(Chosen) A new Vercel app that saves into Pokémon Classroom's existing Supabase project, in its own new tables.**
   - Doesn't use up another Supabase project. The free plan has a small project limit (two active projects, last we checked), and a third would mean paying.
   - Keeps a future automatic star link possible.
   - Cost: it shares a database with an app Kyla uses in class every day, hence the "new tables only" rule.
2. **A new app with its own new Supabase project.** Fully separate, but it may need a paid Supabase plan. Not chosen.
3. **Built into Pokémon Classroom itself.** Ruled out: that app is for Kyla to run in class, and kids and parents shouldn't have a link into it.

**For saving progress,** Supabase was chosen over two alternatives:
- **Vercel's own storage:** awkward for the teacher view's per-class questions.
- **A Google Sheet:** fragile when many kids save at once.

Saving only on the kid's device was ruled out: progress is lost when the browser is cleared, and Kyla sees nothing.

## 5. Student experience

### 5.1 Getting in
- **Personal QR card (main path).** Each kid gets a printed card with a QR code and a link unique to them. The parent scans it once, and the phone remembers the kid after that.
- **Backup path:** go to the app, type the class code, tap your name. Used when a card is lost.
- **"Not you?"** A switch-kid button for siblings sharing a phone.
- **No passwords.** Landing in the wrong kid's account is an accepted risk. It's rare, and Kyla can fix stars by hand.
- **Short Korean instructions** on the parent-facing parts: the QR card, the first screen, and the problem screens. *(Claude's suggestion. Kyla to confirm or write the wording.)*

### 5.2 First time: pick your blob
- **Six colors:** Sunny `#FFD95A`, Peach `#FFC9A8`, Pink `#FFB5C1`, Mint `#B7E1D1`, Sky `#A9D3FF`, Grape `#D9CCF5`.
- Tapping a color recolors the big blob and makes it squish. "That's me!" confirms, and the color can be changed later.
- The blob in that color is the kid's character everywhere in the app.

### 5.3 Home screen
- **Top bar:** the kid's blob, a greeting ("Hi, Minjun!"), and their star total.
- **"This week" card:** the week's skill, lesson progress dots, a "2 more lessons to finish the week" line, and a **Keep going** button. The kid's blob peeks from the corner, and tapping it makes it squish.
- **My winter plan:** a sideways-scrolling row of week cards.
  - Finished weeks show a check on a pastel tile.
  - The current week shows a small version of the kid's blob ("you are here").
  - Future weeks are locked, with their opening day.
  - The last week is the treasure review, with a chest picture.
- **Free practice card:** "Mixed review for bonus stars."
- **Day stamp calendar:** every day the kid practices gets a stamp in their blob color. Like a sticker chart, but missing a day breaks nothing. (Not in the mockups yet. Placement on home or its own screen is the builder's call.)

### 5.4 The plan
- **One plan per class.** Every kid in a class gets the same plan for winter break.
- **Weeks unlock on dates.** Future weeks stay locked until their start date, so kids can't rush through everything on day one. Past weeks stay open.
- **Each week is about 4 short lessons** of 5–10 minutes on that week's essential skill. Finishing all of them completes the week.
- **Kids can redo** any finished lesson as practice.
- **Plan length:** set by the dates Kyla enters. Break is roughly 4–5 weeks, from late December; exact dates are still to come.
- **Content per week:**
  - **Grades 3–4:** grammar review.
  - **Grades 1–2:** grammar review plus phonics review.
  - The weekly skills come from each class's Picture Detective pretest results (see §8).

### 5.5 Free practice
- Mixed questions from every skill the kid has unlocked so far.
- Smaller stars per correct answer, so the weekly plan stays the main thing.
- **Missed questions come back:** questions the kid got wrong in lessons show up more often in free practice until they answer them correctly.

### 5.6 Question types
All seven check themselves.

| Type | What the kid does |
|---|---|
| Listen and tap | Hears a word or sentence, taps the matching written word (phonics, Grades 1–2). Hearing a word and finding it in print is decoding practice in itself, so v1 is words only. The question format should allow an optional picture per choice, to add later |
| Pick the right one | Chooses the one correct sentence out of 2–4 |
| Find and fix | Taps the mistake in a sentence, then chooses the fix. Wrong options come from the common errors in Kyla's grammar ladder |
| Build it | Taps word tiles into order to make the sentence |
| Sort it | Puts words into groups (noun/verb, short a/long a) |
| Fill the blank | Chooses the word that fits |
| Watch and answer | Watches a YouTube video inside the app (e.g. a long e phonics song), then answers a few questions of the types above |

How answering works:
- **Immediate feedback** on each answer.
- **Wrong answers never take stars away.** The kid tries again.
- **The blob reacts:** a happy hop when they're right, a gentle wobble when they're wrong.
- **Feedback is never only motion.** Color and words always say right or wrong too.

**Bonus question:** each lesson has one bonus question, marked with a yellow **Bonus!** tag. The server picks it (one of the lesson's own questions, never a "Just for you" pick and never a watch-and-answer question) and saves the pick, so it stays put on a reload. If the kid's first try at it is right, the lesson pays **+2 stars** on top of its 10, the first time through only; a redo pays nothing. In free practice about one question in eight is a bonus for that kid and day, and a first-try right on it pays 2 instead of 1. The server picks and pays both; the phone only shows the tag.

### 5.7 Read-aloud
- Every Grades 1–2 prompt and answer is read aloud, and there's a **Hear it** button on every question for every grade.
- **Pre-generated audio,** not the phone's built-in voice, which sounds robotic or accented on many Korean phones.
- **One warm American voice** for everything, generated by a voice service when a question is created or edited, and regenerated automatically after edits.
- **Phonics uses whole words** ("bee," "tree"). Voice services aren't reliable at isolated sounds. If isolated sounds are ever needed, those few get recorded by hand.
- The voice service is the builder's choice. Confirm current pricing before committing; the expected cost is small.

### 5.8 Stars
- Stars for finishing a lesson, plus a bonus for finishing a week.
- Free practice gives smaller stars per correct answer.
- **Starting values** (Claude's proposal, easy to tune): 10 per lesson, a 10-star week bonus, and 1 per correct answer in free practice.
- **Bonus questions** (§5.6): +2 for a lesson's bonus question answered right on the first try, first time through only, and 2 instead of 1 for a free-practice bonus question. The week-done total counts lesson bonus stars too.
- The total shows on the home screen at all times.
- **Week done:** a celebration screen with the blob jumping, the stars counting up, and the running treasure chest total ("Opens when you're back at school").

### 5.9 Polish features Kyla said yes to
- **Sounds:** a soft pop on taps, a ding for right, a gentle boop for wrong, a squeak when the blob is poked. A **mute button** for parents.
- **Seasons and holidays:**
  - Light snow on the home screen during the break.
  - A Santa hat at Christmas.
  - A New Year's bow on Seollal.
- **Time of day:**
  - A sleepy "good morning" stretch early in the day.
  - Pajamas and "Time for bed, see you tomorrow!" after 9 pm, using the device's local time. This is a nudge only; nothing gets locked.
- **Flying stars:** an earned star flies from the answer to the star counter.
- **On a roll:** the player counts first-try right answers in a row within one lesson or practice run. At 3 the blob cheers and sparkles pop around it; at 5 it spins and the sparkles come back. Nothing extra after that. A wrong first try sets the count back to 0, with no message or sound of its own.
- **Rotating lines:** the feedback card's title comes from a pool of short lines (12 for right, 12 for almost, 5 for three in a row, 5 for five in a row), never the same line twice in a row. On a right answer the blob names the answer where it can (`“ate” fits!`, `went, not goed!`). Lines are not read aloud.
- **Rising ding:** each first-try right in a row plays the ding a semitone higher, up to the fifth; a reset brings it back down.
- **Recap:** the lesson-done and practice-done screens show up to three pastel tags with what the kid did ("You built 2 sentences", "You fixed 4 mistakes"). Never a score, a count of wrong answers, or a percentage.
- **Friendly problem screens:**
  - Loading: the blob bounces.
  - No internet: the blob holds an umbrella.
  - Error: a calm message with a retry button.
  - Never a blank or broken screen.
- **QR cards** (see §7.4).

### 5.10 Visual design: "Soft Blobs" (direction D)
- **Mockups:** the D screens on the [design canvas](https://claude.ai/artifact/3KraTa4mQJZVVkPUwz3FhX): pick your blob, home, a question, and week done. They are the reference for look and motion. Directions A–C on the same canvas were not chosen.
- **Colors:**
  - Off-white background `#F7F3EF`, white cards.
  - Near-black `#1F1F1F` for text and the main button; muted text `#6B655F`.
  - Pastel accents: yellow `#FFE59A`/`#FFD95A`, pink `#FFB5C1`, mint `#B7E1D1`, blue `#A9D3FF`.
  - One orange `#F97940`, used only for small sparkle doodles.
- **Fonts:** M PLUS Rounded 1c for the interface. Andika for the sentences kids read inside questions, because it's designed for early readers. Fonts with the double-story "a" are fine for this app.
- **Shapes:**
  - Large rounded cards (28px) with no borders.
  - The main action is always a black pill button with a yellow arrow circle.
  - Pastel pill tags for labels.
- **Spend boldness once:** one loud element per screen.
- **Icons:** simple line icons in one consistent style.
- **Labels:** sentence case, no all-caps.
- **Mascot:** an original rounded blob with two dot eyes and pink cheeks. Faces: idle, happy (closed arcs and a smile), oops (small round eyes and a sweat drop), and sleepy (lines).

### 5.11 Motion
These timings are already in the mockup code:
- **Always on:**
  - Breathing: a slow squash, 3.2s loop.
  - Blinking: about every 5 seconds, offset between blobs.
  - On the question screen, the eyes glance down toward the answers now and then.
- **Reactions:**
  - Hop when right (500ms).
  - Wobble when wrong (400ms).
  - Squish when the kid pokes their blob (500ms).
  - Double jump on week done, with sparkles popping in one after another and the stars counting up.
- **Buttons** press in slightly (scale 0.97, 160ms).
- **Still on purpose:** text, progress bars, and the home star total don't move.
- **Reduce motion:** when the device setting is on, movement stops but faces and colors still change.

## 6. Teacher experience (Kyla)

- **Login:** Kyla signs in with her own Supabase account. Students never see the teacher side.
- **Classes view:** her four classes. Each opens a list of students showing:
  - stars this break
  - days practiced
  - time practiced
  - weeks done
  - the last skill practiced
- **Student view:** the skills that kid has practiced, with dates. **Nothing more.** No scores or analytics.
- **Treasure chest numbers:** the class list shows each kid's star total, so Kyla can copy them into Pokémon Classroom when school starts. She picks the conversion rate then, and the app doesn't convert anything.
- **Question editor:**
  - Add, edit, and delete questions in any lesson. Audio regenerates on save.
  - Paste a YouTube link for "watch and answer." The app checks that the video can be played inside the app and warns if it can't.
- **Plan setup:** set each week's dates and skill, per class.
- **Roster and QR cards:** see §7.

## 7. Students, rosters, and login details

### 7.1 Where the student list comes from
- **Source:** Kyla's student export (`students-full-2026-11-25.csv`, from her school system). Columns: UUID, Name, Korean Name, Grade, English Class, Korean Class, Class Number, Active.
- **Import** the active Snapdragon rows for Grades 1–4 into this app's own roster table. Grade 5 is excluded.
- **Keep each row's UUID** as the student's ID, so the app can link back to the same student elsewhere later.
- **Store only what the app needs:** UUID, display name, grade/class, and blob color. Don't store the Korean name, Korean class, or class number.
- **Display names:**
  - Use the English name in parentheses if there is one: "Baek Seo Yoon (Olivia)" shows as "Olivia."
  - Otherwise use the given name without the surname: "Ok Ji Yoon" shows as "Ji Yoon," "Park Aurora" as "Aurora."
  - Kyla can edit any display name.
  - There are no duplicate names within a class today. If one appears, add a last initial.
- The export isn't stored in this doc. Kyla provides it to the builder.
- **Never write to Pokémon Classroom's tables.**

### 7.2 Personal links
- Each kid's QR card opens a link carrying a long random secret unique to that kid. That secret is what identifies them; there's no password.
- Kyla can reissue a kid's link if a card is lost or shared.

### 7.3 Class-code path
- Class code, then tap your name. It's weaker than the personal link (anyone with the code can tap any name), and that's accepted.

### 7.4 QR cards
- A printable sheet per class, one card per kid, with:
  - the kid's name
  - the QR code
  - the class code as a backup
  - short Korean instructions for parents
- Cards show the kid's blob in their color once they've picked one. A plain card is fine for the first print.

## 8. Content

- **Where the skills come from:** the Picture Detective pretest results, one workbook per grade, each with a Snapdragon tab:
  - Grade 1 and Grade 2: workbooks from the same pretest analysis.
  - [Grade 3](https://claude.ai/artifact/Jh2acjZ9fz2UcRJ27nYWjA)
  - [Grade 4](https://claude.ai/artifact/Uhoc5sfX4YhaNm779kkqW6)
- **How weeks are chosen:** each class's winter weeks target that class's biggest error groups from its results. For example, Grade 4's largest groups are past tense (36% of students) and plurals (29%). The grammar ladder and scope and sequence give the mastery examples and the common errors, and the common errors become the wrong options.
- **Drafting:** Claude drafts each class's weekly skill list from these results first, for Kyla to confirm. Then Claude bulk-drafts the questions as a file, Kyla reviews them, and they're imported.
- **Order of work:**
  1. The test plan and Week 1 for all four classes, reviewed before the test weeks.
  2. Later weeks before each one unlocks. They can be finished during break if needed.
  - Roughly 600+ questions in all.
- **Accuracy matters most.** Kyla's rule for teacher materials is that obvious mistakes make people stop using them; the same goes for kids and parents. Content gets reviewed before the test weeks.
- **About 8 questions per lesson** (Claude's proposal). Free practice needs enough variety that kids aren't just memorizing answers.

## 9. Built for homework later

A "plan" is a set of dated weeks given to a group of kids. A group can be a whole class or a few kids. Winter break is the first plan.

The data should allow small-group plans from the start, even though the v1 screens only assign plans to whole classes. That way the homework version later needs new screens, not a rebuild.

## 10. Timeline

- **About Dec 10:** working in class for the two test weeks: kids log in at school, parents try at home, and problems get fixed.
  - Kids use a short separate **test plan**: one week of lessons per class, open right away.
  - **Test stars are reset before break,** so they don't land in the treasure chests. The day stamps and blob color they picked are kept.
- **Late December:** break starts and the winter plan opens. Exact dates to come.
- **First week back:** Kyla reads the star totals and opens the treasure chests in Pokémon Classroom by hand.

## 11. Decided vs. left to the builder

**Decided by Kyla:**
- Vercel; Supabase, in Pokémon Classroom's project with new tables only; a separate app.
- Snapdragon G1–G4.
- Easy login: QR card and class code with name. No passwords.
- One weekly plan plus free practice. No streaks, no free writing. Stars feed Pokémon Classroom by hand.
- The seven self-checking question types.
- The teacher view shows completion, not scores.
- An editor for her, plus Claude's bulk drafts.
- The Soft Blobs look, animated blobs, and kids picking their own blob color.
- Sounds, seasons and holidays, time of day, flying stars, friendly problem screens, the day stamp calendar, missed questions coming back, and QR cards.
- No blob-friend collection.
- The roster comes from her student export, Grades 1–4 only.
- The weekly skills come from the Picture Detective results.
- No approval needed.

**Claude's calls (Kyla can override):**
- Display names: the English name, else the given name.
- A test plan, with test stars reset before break.
- Listen and tap is words-only in v1.
- Week-by-week content staging.
- Pokémon Classroom's access settings left untouched, with any problem reported separately.
- Future weeks locked until their date.
- Lessons of about 4 per week and about 8 questions each.
- Star values.
- Korean parent instructions.
- Pre-generated voice audio.
- Data shaped for small-group homework plans later.
- The mute button.
- The 9 pm bedtime nudge.

**Left to the builder:**
- Framework: match Pokémon Classroom's stack where sensible.
- Table design within the "new tables only" rule.
- Supabase access rules for this app's tables that keep kids from reading each other's data, without giving this app's kid-facing pages any new access to Pokémon Classroom's tables.
- The voice service.
- Where the day stamp calendar sits.
- Sound files.
- How "time practiced" is measured.
- Holiday dates logic.
- The YouTube embed check.
