import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { Video } from '@videojs/react/video';
import { Player } from './player';
import { OffsetSkin } from './OffsetSkin';

const REMOTE_DEMO =
  'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4';
const DEMO_SOURCE = new URLSearchParams(window.location.search).has('remote')
  ? REMOTE_DEMO
  : '/demo.mp4';

export function App() {
  const mediaRef = useRef<HTMLVideoElement>(null);

  return (
    <main className="page-shell">
      <header className="hero-copy">
        <div className="eyebrow">VIDEO.JS 10 · TEMPORAL COMPARISON SKIN</div>
        <h1>OFFSET</h1>
        <p className="hero-line">Two moments. One frame.</p>
        <p className="hero-note">
          Pin a moment without losing where you are. Then measure what changed.
        </p>
      </header>

      <section className="player-wrap" aria-label="OFFSET Video.js demo">
        <Player>
          <OffsetSkin
            source={DEMO_SOURCE}
            mediaRef={mediaRef}
            style={
              {
                '--media-accent-color': '#f0ff67',
                '--media-border-radius': '24px',
              } as CSSProperties
            }
          >
            <Video
              ref={mediaRef}
              src={DEMO_SOURCE}
              playsInline
              preload="metadata"
            />
          </OffsetSkin>
        </Player>
      </section>

      <footer className="page-footer">
        <span>PIN · COMPARE · MEASURE</span>
        <span>R = pin reference</span>
      </footer>
    </main>
  );
}

