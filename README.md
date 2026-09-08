# Verdict landing page

Next.js + TypeScript + React. Adapted from the supplied Sharplink reference and Verdict PRD, with Archivo fonts, original artwork, scroll-craft choreography, and a locally rendered Hyperframes film.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Production: `npm run build` then `npm start`. Check the deterministic demo policy with `npm test`.

## Content and interactions

- Header-to-footer responsive page, navigation, authority selector, FAQ and keyboard-accessible video dialog.
- Fictional asset example evaluates all four states. Evidence export downloads the actual selected local state.
- No wallet, chain connection, paid service, email subscription, analytics or secrets required.
- The PRD's live ENSv2 application is separate work. The demo is prominently labeled and cannot be mistaken for live resolver output.

## Assets

- `public/assets/verification-core.png`: original generated chrome-core artwork; WebP delivery variant includes alpha.
- `video/index.html`: editable Hyperframes composition. `video/BRIEF.md` records intent.
- `public/assets/verdict-concept.mp4`: silent local Hyperframes output.
- `components/marks.tsx`: original Verdict mark and stylized ENS/ETH/USDC/DAI/BTC ecosystem vector illustrations. These are not endorsements. Use official brand kits for final trademark lockups.
- `docs/GEMINI-PROMPTS.md`: optional cinematic replacement footage prompts and image provenance.
- `scrollcraft/builds/verdict/BRIEF.md`: reference observations, layer contract, feeling curve and page score.
- `lab/`: local visual verification evidence; not served publicly.

## Re-render the video

```sh
cd video
npx hyperframes@0.8.31 check --snapshots
npx hyperframes@0.8.31 render --quality high --workers 2 --output ../public/assets/verdict-concept.mp4
```

Hyperframes renders locally without paid image/video generation credits. Its original generated core was made using the available built-in image tool, whose underlying model identifier was not exposed. No claim of using Seedance for the still.

## Design sources

- https://www.sharplink.com/ — inspected live and compared with the supplied full-page reference. Adapted typography, square controls, blue/silver industrial language, section proportions and oversized footer.
- https://21st.dev/ — inspected as a component/motion reference; no third-party component source copied.
- `mynotes/Verdict-prd.md` — product facts and local example policy.

No deployment has been performed.
