# Pre-release accessibility and upload checklist

Record release commit, environment, date, tester, browser/OS or device model, and attach screenshots/video, console/network diagnostics, and issue links for every failure.

## Keyboard-only

- Complete every available ambassador and admin journey without a pointer.
- Verify logical focus order, a visible 2 px focus indicator, no keyboard trap, operable dialogs, and focus restoration after overlays.
- Confirm all actions work with Enter/Space as appropriate and status/error remedies are announced in document order.

## Screen reader

- Spot-check the same journeys with VoiceOver/Safari and NVDA/Firefox or Chrome.
- Verify page and dialog names, landmarks, headings, control names/states, validation messages, progress updates, and completion/failure announcements.
- Record the assistive-technology and browser versions and the exact route/state checked.

## Physical-device upload torture

Use at least one supported iOS device and one supported Android device with a large upload in progress. For each device:

1. Start an upload, enable airplane mode during an active chunk, wait, disable it, and verify resume without duplication or lost progress.
2. Repeat while switching to another app long enough for background suspension.
3. Repeat across lock-screen/unlock.
4. Let the session token roll over during upload and verify a failed chunk refreshes credentials and resumes.
5. Confirm commit occurs once, the final asset size/type is correct, and no partial asset becomes library-visible.

Capture timestamps, file size/type, asset ID, network transitions, visible progress before/after, final state, and relevant redacted platform-log lines. Never attach credentials, tokens, signed URLs, or personal media to evidence.
