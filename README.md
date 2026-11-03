# Recall Riot

A React Native and Expo study game for web, Android and iOS. Upload your own reviewer and the AI chooses multiple-choice or written recall for each concept. Each correction includes a passage from the file. Pick a Tagalog or Bisaya bot for uncensored trash talk on mistakes and praise on correct answers.

## Run locally

Use Node 24 and npm. From the project folder:

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and set `AI_API_KEY` to a server-side API key. The default provider uses OpenAI Chat Completions. An alternative endpoint must support the same JSON response format.
3. Run `npm run server` in one terminal.
4. Run `npm run web` in another terminal and open the URL printed by Expo.

On a physical phone, put the phone and computer on the same trusted Wi-Fi. Set `HOST=0.0.0.0` and `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:8787` in the local environment file. Restart the server and Expo, run `npm start` and open the project with an SDK 58-compatible Expo client or development build. The public URL is bundled into the app. Keep credentials on the server.

## Game rules

- Begin with three lives. A correct answer earns 10 coins and a mistake costs one life.
- A missed question returns once at the end of the queue so you can practice the correction.
- Spend 20 coins during a run for one extra life. You can revive if you have the coins and questions remain.
- Multiple choice uses exact option matching. Written responses are graded by meaning, with translations and accurate paraphrases accepted.
- Upload TXT, Markdown, DOCX or a text-based PDF, up to 3 MB and 60,000 extracted characters. Export scanned pages to text first.
- The backend sends extracted text to the configured AI provider. It holds quizzes in memory for one hour. Restarting it clears sessions. The app saves the current session token on the device so you can resume after closing the app.

## Verification

`npm test` exercises the API with a local fixture provider, without credentials or billable calls. `npx expo export --platform all` creates web, Android and iOS bundles in `dist`. With Chrome installed, run `node tests/browser.mjs` after exporting to verify desktop and phone-width playthroughs.

The API defaults to loopback for personal use. Before exposing a paid provider key through a public deployment, place the service behind authentication and request limits.

Browsers on the same computer can use a localhost or loopback origin. To use a browser on another device, set `CLIENT_ORIGIN` on the server to the exact Expo web origin, including its port. Native clients do not need this setting. PDF uploads can contain up to 200 pages. When a correction cites text from one PDF page, the feedback shows its page number.
