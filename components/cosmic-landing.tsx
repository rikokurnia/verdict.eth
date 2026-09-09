'use client';

// Adapted from testing3's three-scene, scroll-scrubbed landing page.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Menu, X, Pause, Play, ShieldCheck } from 'lucide-react';
import { VerdictMark, EnsMark } from './marks';
import WalletConnect from './wallet-connect';
import { useWallet } from './wallet-context';
import './cosmic-landing.css';

const TOKENS = [
  { name: 'Bitcoin', ticker: 'BTC', file: 'bitcoin.png', text: 'A familiar asset. A clearer way to inspect the evidence.' },
  { name: 'Ethereum', ticker: 'ETH', file: 'ethereum.png', text: 'The foundation for portable identities and onchain evidence.' },
  { name: 'USD Coin', ticker: 'USDC', file: 'usdc-coin.png', text: 'For tokenized value, the sources behind the claim matter.' },
  { name: 'Tether', ticker: 'USDT', file: 'usdt.png', text: 'Look beyond the ticker. Understand the supporting records.' },
  { name: 'Dai', ticker: 'DAI', file: 'dai.png', text: 'One shared language for people, applications, and agents.' },
];

function FloatingCore({ small = false }: { small?: boolean }) {
  return <div className={`cosmic-core ${small ? 'cosmic-core-small' : ''}`} aria-hidden="true"><div className="cosmic-core-float"><img src="/assets/verification-core.webp" width="1024" height="1536" alt=""/>{Array.from({length: 9}, (_,i) => <span className="cosmic-particle" key={i} style={{'--i':i} as CSSProperties}/>)}</div></div>;
}

export default function CosmicLanding() {
  const router = useRouter();
  const { isConnected, connect } = useWallet();
  const [wantsWorkspace, setWantsWorkspace] = useState(false);

  const journey = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const mobileMenu = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const [token, setToken] = useState(1);

  useEffect(() => {
    if (wantsWorkspace && isConnected) {
      setWantsWorkspace(false);
      router.push('/dashboard');
    }
  }, [wantsWorkspace, isConnected, router]);

  const handleProtectedNav = (e: React.MouseEvent) => {
    if (!isConnected) {
      e.preventDefault();
      setWantsWorkspace(true);
      connect();
    }
  };

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches); sync();
    media.addEventListener('change', sync); return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = journey.current, clip = video.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, -rect.top / Math.max(1, root.offsetHeight - innerHeight)));
      setProgress(p);
      if (clip && !reduced && !paused && Number.isFinite(clip.duration) && !clip.seeking) {
        const target = p * Math.max(0, clip.duration - .08);
        if (Math.abs(clip.currentTime - target) > .035) clip.currentTime = target;
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, {passive:true});
    window.addEventListener('resize', schedule);
    const clip = video.current;
    clip?.addEventListener('loadedmetadata', schedule);
    clip?.addEventListener('seeked', schedule);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); clip?.removeEventListener('loadedmetadata', schedule); clip?.removeEventListener('seeked', schedule); };
  }, [paused, reduced]);
  const first = Math.max(0, Math.min(1, (.32 - progress) / .08));
  const middle = Math.min(Math.max(0,(progress-.27)/.09), Math.max(0,(.72-progress)/.1),1);
  const last = Math.max(0, Math.min(1,(progress-.64)/.1));
  const current = progress < .3 ? 0 : progress < .68 ? 1 : 2;
  const nav = <><a href="#cosmic-start">The idea</a><a href="#cosmic-evidence">The evidence</a><Link href="/dashboard" onClick={handleProtectedNav}>Open workspace <ArrowUpRight size={13}/></Link></>;
  return <div className={`cosmic-page ${reduced ? 'cosmic-reduced' : ''} ${paused ? 'cosmic-paused' : ''}`}>
    <a className="cosmic-skip" href="#cosmic-start">Skip to content</a>
    <header className="cosmic-nav"><Link href="/" className="cosmic-brand" aria-label="Verdict home"><VerdictMark/>Verdict<span>THE EVIDENCE LAYER</span></Link><nav aria-label="Main navigation">{nav}</nav><div className="cosmic-nav-actions"><WalletConnect/><button ref={menuTrigger} className="cosmic-menu" aria-label="Open menu" onClick={() => mobileMenu.current?.showModal()}><Menu size={22}/></button></div></header>
    <main ref={journey} className="cosmic-journey" data-sc-act={reduced ? 'flow' : 'scrub'} style={{'--sc-p':progress} as CSSProperties}>
      <div id={reduced ? undefined : 'cosmic-start'} className="cosmic-anchor cosmic-anchor-start"/>
      <div id={reduced ? undefined : 'cosmic-evidence'} className="cosmic-anchor cosmic-anchor-evidence"/>
      <div id={reduced ? undefined : 'cosmic-workspace'} className="cosmic-anchor cosmic-anchor-workspace"/>
      <div className="cosmic-stage" data-sc-stage>
        <div className="cosmic-media" aria-hidden="true"><video ref={video} data-sc-scrub onLoadedData={() => journey.current?.classList.add('sc-has-clip')} src="/assets/cosmic-journey.mp4" poster="/assets/cosmic-poster.webp" muted playsInline preload="auto"/></div>
        <section id={reduced ? 'cosmic-start' : undefined} className="cosmic-scene cosmic-hero" style={{'--scene-opacity':first} as CSSProperties} inert={!reduced && current !== 0} aria-hidden={!reduced && current !== 0}>
          <div className="cosmic-copy"><p className="cosmic-eyebrow"><span/> ONE NAME. EVERY REASON.</p><h1>Know what<br/>backs the asset.</h1><p className="cosmic-description">The issuer. The audit. The risks.<br/>Verdict brings the evidence together, so you can see the whole picture.</p><div className="cosmic-actions"><Link className="cosmic-button" href="/dashboard" onClick={handleProtectedNav}>Explore the workspace <ArrowUpRight size={17}/></Link><a className="cosmic-text-link" href="#cosmic-evidence">How it works <ArrowRight size={16}/></a></div><div className="cosmic-ens"><EnsMark/><span>Built around Ethereum Name System</span></div></div>
          <FloatingCore/>
          <span className="cosmic-caption">IDENTITY, WITH THE EVIDENCE ATTACHED.</span>
        </section>
        <section id={reduced ? 'cosmic-evidence' : undefined} className="cosmic-scene cosmic-cloud" style={{'--scene-opacity':middle} as CSSProperties} inert={!reduced && current !== 1} aria-hidden={!reduced && current !== 1}>
          <div className="cosmic-cloud-copy"><p className="cosmic-eyebrow">BEYOND THE TICKER</p><h2>Less guesswork.<br/>More evidence.</h2><p className="cosmic-description">See who issued it, who checked it,<br className="cosmic-desktop"/> and whether their evidence is still current.</p></div>
          <div className="cosmic-coins" role="group" aria-label="Explore the onchain ecosystem">{TOKENS.map((t,i) => <button key={t.ticker} className={token===i ? 'cosmic-coin selected' : 'cosmic-coin'} style={{'--coin-index':i} as CSSProperties} onClick={()=>setToken(i)} aria-pressed={token===i} aria-label={t.name}><img src={'/assets/'+t.file} width="180" height="180" alt=""/><span>{t.ticker}</span></button>)}</div>
          <p className="cosmic-token-description" aria-live="polite">{TOKENS[token].text}</p>
          <div className="cosmic-proof-row"><span><ShieldCheck size={16}/>Independent sources</span><span>Visible expiry</span><span>Clear reasons</span></div><p className="cosmic-token-note">Ecosystem illustrations, not endorsements or live integrations.</p>
        </section>
        <section id={reduced ? 'cosmic-workspace' : undefined} className="cosmic-scene cosmic-close" style={{'--scene-opacity':last} as CSSProperties} inert={!reduced && current !== 2} aria-hidden={!reduced && current !== 2}>
          <FloatingCore small/>
          <div className="cosmic-copy"><p className="cosmic-eyebrow">FROM A NAME TO AN ANSWER</p><h2>See the proof.<br/>Make your call.</h2><p className="cosmic-description">Explore an asset. Inspect its sources.<br/>Understand why the verdict changes.</p><Link className="cosmic-button" href="/dashboard" onClick={handleProtectedNav}>Open Verdict <ArrowUpRight size={17}/></Link><p className="cosmic-demo-note">Interactive demo. No investment advice.</p></div>
          <footer className="cosmic-footer"><Link href="/" className="cosmic-brand"><VerdictMark/>Verdict</Link><span>Evidence travels with the name.</span><Link href="/dashboard" onClick={handleProtectedNav}>Workspace <ArrowUpRight size={13}/></Link><a href="/verdict-overview.md" download>Overview <ArrowUpRight size={13}/></a><small>© {new Date().getFullYear()} Verdict</small></footer>
        </section>
        <div className="cosmic-scene-controls"><span>{['The idea','The evidence','Your next step'][current]}</span><div className="cosmic-progress" aria-hidden="true"><span style={{transform:`scaleX(${progress})`}}/></div><button aria-label={reduced ? 'Motion disabled by system preference' : paused ? 'Resume motion' : 'Pause motion'} disabled={reduced} aria-pressed={paused || reduced} onClick={()=>setPaused(!paused)}>{paused || reduced ? <Play size={14}/> : <Pause size={14}/>}</button></div>
      </div>
    </main>
    <dialog ref={mobileMenu} className="cosmic-menu-dialog" aria-label="Navigation" onClose={()=>menuTrigger.current?.focus()}><button className="cosmic-dialog-close" aria-label="Close menu" onClick={()=>mobileMenu.current?.close()}><X/></button><VerdictMark/><nav onClick={()=>mobileMenu.current?.close()}>{nav}</nav><p>One name. Every reason.</p></dialog>
  </div>;
}
