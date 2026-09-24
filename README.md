# Magic Violin (Kids Banjo)

A touch violin for kids aged 4 to 12. It should feel like a real instrument while staying very simple to play.

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
npm test           # 46 unit tests: music theory, songs, gestures, game rules, orchestra, recording
npm run test:e2e   # browser tests on a Pixel 7-sized screen; screenshots go to test-results/shots/
```

## Why this stack

- **TypeScript + Web Audio API + Canvas, no framework.** A violin has to respond instantly to your finger. Web Audio creates the sound in real time (pitch bend, vibrato and bow pressure are all live), and Canvas draws the strings at 60 fps.
- **Runs today in any phone browser** and can be added to the home screen (PWA).
- **Becoming an Android/iOS app** is the next step with [Capacitor](https://capacitorjs.com/), which wraps this same code in a native app for the Play Store and App Store.

## Code map

```
src/music/     notes, strings, keys, the 10 songs, chord choice
src/input/     gesture.ts: finger movement to bow speed, direction, vibrato
src/audio/     violinVoice (the violin sound), orchestra + arranger (the band), instruments
src/violin/    fingerboard layout, the canvas violin, skins
src/game/      Falling Notes rules
src/record/    record / replay / My Music storage
src/ui/        screens
```

## Next ideas (from the product vision)

Draw a Song, Music Garden, Parent Area (practice time, streaks), mini lessons, tuner, Concert mode, more skins and worlds, Duet mode, and exporting a music video.
