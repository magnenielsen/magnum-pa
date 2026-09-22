# Magnum PA

A phone-as-microphone + sound-effects board for any Bluetooth speaker. Installable PWA, no backend, no accounts, no audio ever leaves the device.

## What it does

- **Mic tab** — opens the phone mic and pipes it straight to the phone's audio output (which is the paired Bluetooth speaker) via the Web Audio API. Gain control, live level meter with clip indicator, optional echo cancellation / noise suppression.
- **Board tab** — 10 sound effects (alarm, laugh, air horn, applause, drum roll, ding, boing, buzzer, crowd cheer, record scratch), bundled as CC0 recordings and loudness-matched on load. Everything runs through a shared limiter so stacked pads can't clip the speaker.
- **Find Sounds** — search Freesound from inside the app and swap any pad. Swaps are stored on the device and work offline. Needs a free Freesound API key, entered once and kept in the browser.
- Effects auto-duck the mic briefly when triggered, so they cut through without feedback.
- Installable: manifest + service worker + icons included. "Add to Home Screen" gives a standalone app with offline launch.

## Sounds and licensing

The ten pads ship as CC0 recordings from [Freesound](https://freesound.org). CC0 is a public
domain dedication: commercial use is fine, no attribution is required, and — unlike the
Pixabay and Mixkit licenses — there is no clause against redistributing the files themselves,
which matters here because a soundboard serves unmodified audio by design. Each file's
license was checked on its own sound page, not assumed from a search filter.

Credit is not required, but it is deserved:

| Pad | Sound | By |
|---|---|---|
| Alarm | [Alarm No.3](https://freesound.org/people/Vendarro/sounds/345815/) | Vendarro |
| Laugh | [Crowd laugh](https://freesound.org/people/deleted_user_2104797/sounds/324894/) | deleted_user_2104797 |
| Air Horn | [Airhorn](https://freesound.org/people/jacksonacademyashmore/sounds/414208/) | jacksonacademyashmore |
| Applause | [Clapping](https://freesound.org/people/Camo1018/sounds/425663/) | Camo1018 |
| Drum Roll | [buzz roll](https://freesound.org/people/bigjoedrummer/sounds/77305/) | bigjoedrummer |
| Ding | [bell ding 1](https://freesound.org/people/5ro4/sounds/611113/) | 5ro4 |
| Boing | [Boing 2](https://freesound.org/people/magnuswaker/sounds/540790/) | magnuswaker |
| Buzzer | [buzzer](https://freesound.org/people/guitarguy1985/sounds/54047/) | guitarguy1985 |
| Crowd Cheer | [cheering and clapping crowd 2](https://freesound.org/people/AlaskaRobotics/sounds/221567/) | AlaskaRobotics |
| Scratch | [record_scratch](https://freesound.org/people/simkiott/sounds/43404/) | simkiott |

These are Freesound's public preview MP3s (~870 KB for all ten), which is ample for a
Bluetooth speaker. If you swap a pad via in-app search, check the license of what you pick —
the search defaults to CC0 only, and warns you when you turn that filter off.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app — UI, mic logic, sound engine, Freesound search |
| `sounds/*.mp3` | The ten bundled CC0 effects |
| `manifest.json` | PWA metadata (name, icons, display mode) |
| `sw.js` | Service worker — caches the app shell for offline/instant launch |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | App icons (the maskable one keeps its artwork inside the 80% safe zone) |
| `icon.svg` | Vector source the PNG icons are rendered from |

## Running it

Any static file host with HTTPS works — the mic requires a secure origin. Two options:

**GitHub Pages (recommended, free)**
```bash
git init
git add .
git commit -m "Magnum PA"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
# enable Pages in repo settings, root of main branch
```
Then open the Pages URL on the phone and "Add to Home Screen."

**Local test**
```bash
python3 -m http.server 8443
```
(getUserMedia works on `localhost` without HTTPS for local testing only — a real deploy needs HTTPS.)

## Known limitations

- **iOS Safari** may downgrade the Bluetooth speaker to call-quality (mono, narrowband) audio while the mic is active. This is an OS-level routing behavior, not something the app controls.
- Bluetooth introduces ~150–300ms latency — expected, not a bug.
- No mic passthrough while the phone is locked (screen wake lock keeps it live, but locking still suspends `getUserMedia` on most mobile browsers).
- Feedback risk: keep the phone physically away from the speaker, or use headphones for monitoring if the venue is loud.

## Possible next steps

- **Local file import**: load a clip from the phone's own storage, alongside the Freesound search.
- **Presets**: save gain/EC/NS combos per venue.
- **Hold-to-loop** on FX pads (e.g. held drumroll, held applause).
- **Bluetooth output device picker** — not exposed by any web API today; would require a native wrapper (Capacitor/Cordova) to control audio routing directly.
- **Limiter/compressor** on the mic chain to tame clipping automatically instead of just flagging it.
- **Keyboard/MIDI triggering** for the board if used from a laptop as a controller.

## How the sound engine works

Each pad is an MP3 decoded once into an `AudioBuffer` and triggered from there — no
per-tap decoding, so a tap costs a couple of milliseconds. All ten are fetched and
decoded when you open the Board tab, one per idle slot, so the first tap never waits.

**Loudness is measured, not re-encoded.** Recordings from ten different uploaders arrive
at wildly different levels — these ten spanned **11.4×** as downloaded. On load each clip
gets a gain that brings it to a common target, which leaves the files untouched and, more
importantly, applies to clips loaded later through search too. The measure is the 90th
percentile of 50 ms block RMS rather than plain RMS, so a clip with a long quiet tail
isn't boosted to make its silence loud. After normalizing, the spread is **1.14×**.

`CEILING` is deliberately set above full scale. Most of these files are already mastered
to a peak of ~1.0, so clamping the gain to keep peaks under 1.0 leaves peaky material far
below the loudness target — the drum roll landed at 44% of it. The bus limiter is what
catches peaks; `CEILING` only stops a pathological clip from slamming it.

**Swapped pads** live in IndexedDB as the decoded-from bytes, keyed by pad. A pad with a
stored override never fetches its bundled file, so swaps work offline and survive reinstalls
of the service worker cache. "Restore default" deletes the record and the bundled file
takes over again.

**The Freesound key** is sent in an `Authorization` header, never as a URL parameter, so it
stays out of referrers, proxy logs and browser history. It is kept in `localStorage` on the
device and is never bundled into the app — if you publish this, each user brings their own.

## Notes on the audio engine

- Effects duck the mic to 15% while they play and restore it to the **gain slider's** value, not to whatever the gain node happens to read at that moment — reading the live node meant two overlapping effects left the mic stuck at 15%.
- Each trigger opens a "voice" that owns its nodes and tears them down when the clip ends, so a long set doesn't accumulate dead audio nodes. **Stop All** kills every live voice and releases the duck immediately.
- The FX volume slider applies to sounds that are already playing, and scales each pad's normalization gain rather than replacing it.
- Everything lands on a shared `DynamicsCompressor` before the output, so stacking pads can't clip the speaker.
- `sw.js` caches assets one at a time rather than with `cache.addAll()`, which is atomic — one missing file there aborts the whole install and silently leaves the app with no offline cache. The app shell is served network-first so a redeploy is picked up on the next online launch; bump `CACHE` when you ship.
