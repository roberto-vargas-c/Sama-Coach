// What the support assistant knows about Sama. Kept on the server so it is the same for every client.
// Files in /api that start with "_" are not endpoints on Vercel.
module.exports = `
SAMA, A FREE YOGA APP (web app at sama.rest, also an Android app and an installable home-screen app). No ads, no tracking, made by one person (Roberto Vargas).

MAIN TABS (top of the screen): Today · Check alignment · Plan a practice · Library · Coach · Studios.

TODAY (the first tab, where the app opens)
- A daily practice planned once: the first time, Sama asks what you want from yoga, how many minutes you have and how many days a week. From then on Today shows your next practice, ready to start with one button, with the coach figure showing its poses.
- A first month for beginners in four steps (Arrive, Ground, Build, Flow), then "Keep going". Finishing a practice moves you to the next one; the week dots show the days you practised. Missing days is fine: it simply carries on.
- "Short on time? Make it 10 minutes" gives a shorter version. "See the poses" opens it in the planner. "Adjust my plan" (also in Profile → Your plan) changes the answers; "Start again from week 1" restarts the journey. On period days (if cycle tracking is on) the practice is gentle. The round figure button at the top right opens the Profile. Language (EN/ES/DE) and light/dark/auto theme sit in the top bar.

CHECK ALIGNMENT
- Pick a pose from the rail (filter by family and level), prop the phone up so the whole body is in view, hold the pose. Sama compares each joint (knees, hips, spine, shoulders, arms) with the pose and gives a score plus one thing to fix first.
- Modes: live camera, take a photo, record a short clip, or pick a photo/clip from the gallery.
- The phone can stand in front of the mat or beside it; Sama works out where the camera is and notices when it moves (it can also be set in Settings).
- Settings ("Scene, voice, camera"): the scene behind the figure (studio, living room, park, beach, mountains, night rooftop), the voice guide on/off, camera placement, the figure style, and "Record my moves between poses".
- Show yourself as your figure, or as the video with skeleton and alignment lines.
- The pose model runs on the device; photos, clips and the camera stream are never uploaded.
- "Report a problem" on a pose (in Check or the Library) sends a short report so it gets fixed.
- Camera not working: allow camera access for the site in the browser (or for the Sama app in Android settings), close other apps using the camera, use good light, and make sure the whole body is visible. On iPhone use Safari. A black screen usually means permission was denied; reload after allowing it.

PLAN A PRACTICE
- Choose length, focus and level; Sama builds a sequence and guides it pose by pose with a voice guide and soft music. Nine ready-made practices (e.g. Kind to your back, Ashtanga primary). Practices can be saved.
- Options to take it easy on wrists, knees, back, or the period. Pace: Calm, Flowing or Quick.
- During a practice: tap the right side for the next pose, the middle to pause, the left to go back.
- The figure moves between poses (steps, squats, folds, jumps) timed on real classes; a softer "blob" transition is an option.
- TV: cast or mirror the screen; a big-screen layout keeps the camera and the timer. The Android app has a shortcut to the cast settings.
- The voice guide speaks English for now, even when the app is in Spanish or German.
- No sound: check the phone is not on silent, media volume is up, and that "Voice guide in practices" is On in Settings (the Settings panel, "Scene, voice, camera"). Some browsers need a tap before sound can play.

LIBRARY
- 165 poses with how to do them, what to watch for, a short history, the Sanskrit name and meaning. Search in English or Sanskrit; filter by family and level. Turn the figure to any angle and switch sides.

COACH
- An AI coach (needs an internet connection). It reads your answers and scores, never the camera. Modes: Plan with me, Review my checks, Review a routine (paste one in), Roadmap to a pose (e.g. Crow, headstand). Answers in the app language.

STUDIOS
- Finds yoga studios near you ("Use my location") or in any typed city, closest first, from OpenStreetMap, with links to ClassPass and Urban Sports Club to book. The location is used only for the search.
- If no studios appear: allow location for the site, or type a city; some places simply have few studios listed on OpenStreetMap. Booking happens in ClassPass / Urban Sports Club, not in Sama.
- Teachers and studios can add their own weekly class with "Add your class" (needs sign-in): class name, studio or address, days, time, length, style, level, language, price, booking link, note. Their classes show to people searching nearby and on the studio's card; they can edit or remove them under "Your classes". Anyone can report a class that looks wrong.

PROFILE
- Name, "Change my look" (skin, hair, build, clothes, beard, mat colour, height, standard or XL mat), replay the welcome, the app tour ("Show the app tour").
- My practice: gender, experience, body areas to be gentle with, goal pose, days a week, notes for the coach.
- Optional cycle tracking (stays on the device only): practices adapt on the period and when energy is up; predicted days in the calendar.
- Practice days and a time, with Google Calendar and a reminder.
- Progress: scores, minutes, recent checks, steps toward the goal pose. Saved practices.
- Your data: "Download my data" as one file, "Delete my data" wipes it from this device. Movement recordings (joint positions only) can be downloaded or deleted.
- Support Sama: an optional Ko-fi donation.

ACCOUNT AND SYNC
- Without signing in, everything stays on the device. Signing in (Google, or an email link) syncs profile, checks, saved practices and the look across devices.
- Email link: open the link on the same device and browser where it was requested; check spam. In the Android app, Google sign-in opens in Chrome and returns to the app.
- To remove synced data, sign in and use "Delete my data"; to stop syncing, sign out.

INSTALLING
- iPhone: in Safari, Share → Add to Home Screen. Android: the browser menu → Install app / Add to home screen, or the Sama Android app.
- If the app looks out of date, reload the page (or close and reopen the home-screen app); updates arrive automatically.

PRIVACY
- No analytics or tracking cookies, no ads. Camera images never leave the device. The coach and this help chat send text to an AI service (OpenAI) to answer. Studio search sends the position to OpenStreetMap services. Details at sama.rest/privacy.html.

PRICING: Sama is free. There is no paid plan.
`;
