# Magic Violin (Kids Banjo)

A touch violin for kids aged 4 to 12. It should feel like a real instrument while staying very simple to play.

## The core loop

**Home → Play → Violin → touch & slide notes → Song → guided playing → Score → Reward → Music Garden**

Every step is fully interactive. Progress is saved in the browser (localStorage), so it's still there after you close the app:

- **Play hub** offers Song Journey, Free Violin and Magic Orchestra. After some free play, a "Ready to play a song?" button invites the child into the songs.
- **Guided playing**: 👂 *Listen* lets a fairy play the tune first. In Beginner mode the song waits for each note, and a pointing hand shows which string to play.
- **Score** shows stars and a kind message (never "FAILED").
- **Reward** plants the song's flower, unlocks the next song and grows the Magic Tree.
- **Music Garden** has one plant per song that grows with better stars, the Magic Tree (100 songs to the giant tree), and stats for plants, notes played, practice minutes and the day streak. Tap a plant to play its song again.

## What's in this first version (MVP)

| Feature | How it works |
| --- | --- |
| Realistic touch violin | 4 strings (G D A E) drawn as a violin neck. The sound is made live in the browser, so there are no audio files. |
| Bow gesture | Slide a finger left/right across a string. Faster means louder and brighter. Right is a **down bow** (⊓) and left is an **up bow** (V), and each one sounds slightly different. |
| Pitch bend | Slide up/down along a string. Lower on the screen gives a higher note, and the pitch glides smoothly between notes. |
| Vibrato | Wiggle the finger in small, quick left-right movements. |
| Pressure | Real touch pressure is used on devices that report it. Everywhere else, swipe speed stands in for pressure. |
| Help levels | 🐣 Beginner snaps every finger spot to a nice note and makes songs wait for you. 🧭 Explorer pulls gently toward notes. 🦅 Free is fully manual. |
| Open-string mode | Plays only G, D, A and E, which suits a first lesson. |
| Note names | G A B, Do Re Mi, or Sa Re Ga. D is Do/Sa, the key every song uses. |
| 10 songs | Hot Cross Buns, Mary Had a Little Lamb, Sa Re Ga Ma, Twinkle Twinkle, Frère Jacques, Row Row Row Your Boat, London Bridge, Ode to Joy, Jingle Bells, and Happy Birthday (the boss song). Each one unlocks after the one before it. |
| Falling Notes game | Notes fall down their string. Play each one when it reaches the glowing line. Feedback is always friendly and never says "FAILED". |
| Record & replay | ⏺ records your finger moves. **My Music** replays them with a 🧚 fairy playing your song back. |
| Magic Orchestra | Piano, bass, drums and flute join in based on how you play. Gentle playing brings the piano, fast playing brings the drums, and finishing a song gives you the full-band finale with applause. |
| Violin skins | Classic Wood, Blue Galaxy, Rainbow. |

## Run it

```bash
npm install
npm run dev        # open the printed URL on your phone (same Wi-Fi) or desktop
```

## Test it

```bash
npm test           # 54 unit tests: music theory, songs, gestures, game rules, orchestra, recording, progress
npm run test:e2e   # browser tests on a Pixel 7-sized screen, including the full core loop; screenshots go to test-results/shots/
```

## Deploy and Android APK

Two GitHub Actions workflows run on every push:

- **Build Android APK** (`.github/workflows/android-apk.yml`) runs the tests, builds the app, wraps it with Capacitor and builds `magic-violin.apk`. To get it, open the repo's **Releases** page, find **Magic Violin APK (latest)**, and download the APK on an Android phone. The APK is also attached to each workflow run.
- **Deploy website** (`.github/workflows/deploy-web.yml`) publishes the web version to GitHub Pages. Before it can run, a repo admin has to do a one-time setup: **Settings → Pages → Source: GitHub Actions**.

To build the APK locally (needs Android Studio / Android SDK and JDK 21): `npm run android:apk`. The APK ends up in `android/app/build/outputs/apk/debug/`.

The APK is a *debug* build, which is fine for testing on your own phones. Publishing on the Play Store needs a signed release build (AAB), which is the next step.

## Why this stack

- **TypeScript + Web Audio API + Canvas, no framework.** A violin has to respond instantly to your finger. Web Audio creates the sound in real time (pitch bend, vibrato and bow pressure are all live), and Canvas draws the strings at 60 fps.
- **Runs today in any phone browser** and can be added to the home screen (PWA).
- **Becoming an Android/iOS app** is the next step with [Capacitor](https://capacitorjs.com/), which wraps this same code in a native app for the Play Store and App Store.

## Ready for real instruments later

The code is split so better sound and input can be added without rewriting the app:

- **Real violin samples**: put recordings in `public/samples/violin/` with a `manifest.json` (see `src/audio/violinSound.ts`). The app then uses them automatically instead of the synthesized violin, keeping pitch bend, vibrato and bow intensity.
- **Accompaniment**: the Magic Orchestra takes an `InstrumentBank` (`src/audio/instruments.ts`). A sample or SoundFont (MIDI) bank can replace the synthesized band.
- **Pitch detection / MIDI**: the games score `NoteEvent`s (`src/input/noteInput.ts`), not touches. A microphone pitch detector (a real violin) or a MIDI device can feed the same events.
- **Saved state**: `src/state/profile.ts` holds all progress rules as pure functions, so the same data could later sync to a server.

## Code map

```
src/music/     notes, strings, keys, the 10 songs, chord choice
src/input/     gesture.ts: finger movement to bow speed, direction, vibrato
src/audio/     violinVoice (the violin sound), orchestra + arranger (the band), instruments
src/violin/    fingerboard layout, the canvas violin, skins
src/game/      Falling Notes rules
src/record/    record / replay / My Music storage
src/state/     saved profile: song results, garden, practice stats
src/ui/        screens
```

## Next ideas (from the product vision)

Draw a Song, Music Garden, Parent Area (practice time, streaks), mini lessons, tuner, Concert mode, more skins and worlds, Duet mode, and exporting a music video.
