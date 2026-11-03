# Study session recovery

Players may leave a reviewer open across a class or study break. A run can be restored for one hour, or lost earlier if the local API restarts. Handle both outcomes from the game screen.

1. Extend the browser playthrough in `tests/browser.mjs` to return the API's expired-session response when a player locks in an answer. Verify the player can start again with the same file. Run against the existing web bundle and reproduce the failure.
2. In `App.js`, clear the expired token and return the player to the upload screen while retaining their selected file. Keep the error visible and keep ordinary network failures retryable in place.
3. Run the API suite, export all three platforms and drive the corrected web bundle in Chrome at phone and desktop widths.
4. Verify that the long-running phone-width session retains its rewards and resumes before 1 pm Singapore time. Push verified changes to the specified repository.
