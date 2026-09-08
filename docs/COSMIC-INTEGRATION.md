# Testing3 landing-page integration

The home route now renders `components/cosmic-landing.tsx`. The former landing component is preserved but is no longer served at `/`. `testing3/` is unchanged.

## Included

- Same space → cloud → mountain footage and three-scene structure as testing3.
- Locally hosted Inter, sentence-case headlines and concise copy.
- Smaller floating Ethereum-in-glass asset in the hero and closing scene, with decorative particles.
- All five supplied coin PNGs, horizontal across the cloud scene, with hover/focus lift, entrance motion and selectable explanations.
- Existing Verdict logo, working section links, workspace links and mobile navigation.
- Browser-wallet connection dialog using EIP-1193 `eth_requestAccounts`; cancellation, missing-wallet and pending-request feedback; account-change cleanup. No signing, spending or automatic network switching.
- Reduced-motion document layout and manual pause control.

## Implementation notes

The original testing3 frame-bank decoder was replaced with native video seeking and a short-keyframe H.264 encode. This avoids loading an entire decoded frame bank on phones. Audio was stripped; the 10-second video is about 5 MB. A still poster remains available if playback cannot decode. The generated core is reused; no new image/video generation was claimed.

Newer dashboard edits found during this work were preserved. This integration does not replace the user's current dashboard video/Dock work.

## Verification and limits

- Production build and TypeScript pass; policy tests pass.
- Final desktop/mobile scroll-craft runs: eight settled frames each, video advances 0–9.92s, no dead scroll. Contact sheets in `lab/cosmic-verified-desktop` and `lab/cosmic-verified-mobile` were visually inspected. The cloud scrim was subsequently strengthened for text contrast.
- At 390px: document width is 390px; mobile menu navigates and closes; Bitcoin selection updates its explanation; decoded video opacity is 1.
- Desktop and mobile hero, cloud and closing compositions visually inspected.
- Missing-browser-wallet recovery tested. Real extension approval and physical iPhone playback still require device testing.
- Initial harness runs did not recognize the custom video. Adding metadata exposed a real global CSS collision that hid it behind the poster; a scoped opacity override fixes that. Earlier captures are retained, not presented as passing final evidence.
- The harness records video time, settled frames, request failures and console errors. It does not measure text contrast automatically here because the page does not use SC cue elements; typography was visually reviewed.
- The wallet connection does not make the demo dashboard live. WalletConnect QR / cross-device pairing is not configured.

Run the adapted supplied verifier from `project/`:

```sh
node scripts/verify-cosmic.mjs --url http://localhost:3001 --out lab/cosmic-verified-desktop --width 1440 --height 900 --per-act 6
node scripts/verify-cosmic.mjs --url http://localhost:3001 --out lab/cosmic-verified-mobile --width 390 --height 844 --per-act 6
```

Wallet implementation reference: [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193). The adapter requires the sibling `testing3/scroll-craft` source supplied in this workspace; application runtime does not.
