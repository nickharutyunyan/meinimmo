/**
 * Hand-drawn style illustrations for the Hausbuch design. Inline SVG so they
 * cost no request, scale cleanly and follow the palette tokens.
 */

const STROKE = { stroke: 'var(--ink)', strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** A short German street: Altbau, Plattenbau, Fachwerk and a brick house, with the sun up. */
export function StreetScene({ className = '' }: { className?: string }) {
  return <svg className={`street-scene ${className}`.trim()} viewBox="0 0 560 300" aria-hidden="true" focusable="false">
    <g {...STROKE}>
      <circle className="street-sun" cx="478" cy="58" r="26" fill="var(--butter)" />
      <path d="M520 104c-14 0-14-12-26-12s-12 12-26 12" fill="none" opacity=".5" />
      {/* Gründerzeit Altbau */}
      <path d="M20 298V130l55-40 55 40v168" fill="#e9bfa6" />
      <path d="M20 130h110" fill="none" />
      <rect x="40" y="150" width="22" height="30" rx="2" fill="var(--sky)" />
      <rect className="street-window is-lit" x="88" y="150" width="22" height="30" rx="2" fill="var(--butter)" />
      <rect x="40" y="205" width="22" height="30" rx="2" fill="var(--sky)" />
      <rect x="88" y="205" width="22" height="30" rx="2" fill="var(--sky)" />
      <path d="M62 298v-38a13 13 0 0 1 26 0v38" fill="var(--brick)" />
      {/* Plattenbau with a green cornice */}
      <path d="M140 298V100h120v198" fill="var(--oat)" />
      <path d="M140 100l10-22h100l10 22" fill="var(--sage)" />
      <g fill="var(--sky)">
        <rect x="158" y="118" width="18" height="26" rx="1.5" /><rect x="191" y="118" width="18" height="26" rx="1.5" /><rect x="224" y="118" width="18" height="26" rx="1.5" />
        <rect x="158" y="162" width="18" height="26" rx="1.5" /><rect x="224" y="162" width="18" height="26" rx="1.5" />
        <rect x="158" y="206" width="18" height="26" rx="1.5" /><rect x="191" y="206" width="18" height="26" rx="1.5" /><rect x="224" y="206" width="18" height="26" rx="1.5" />
      </g>
      <rect className="street-window is-lit" x="191" y="162" width="18" height="26" rx="1.5" fill="var(--butter)" />
      <path d="M185 298v-40h30v40" fill="var(--ink)" />
      {/* Fachwerk */}
      <path d="M270 298V170l70-55 70 55v128" fill="var(--paper)" />
      <path d="M282 170v128M398 170v128M270 210h140M270 250h140M300 170l-18 40M380 170l18 40M300 250l-18 48M380 250l18 48" fill="none" />
      <rect x="318" y="190" width="44" height="40" rx="2" fill="var(--butter)" />
      <path d="M340 190v40M318 210h44" fill="none" />
      <path d="M330 298v-34h20v34" fill="var(--brick)" />
      {/* Brick house */}
      <path d="M420 298V205h120v93" fill="var(--brick)" />
      <path d="M420 205l60-38 60 38" fill="var(--ink)" />
      <rect x="438" y="225" width="26" height="24" rx="2" fill="var(--sky)" />
      <rect x="496" y="225" width="26" height="24" rx="2" fill="var(--sky)" />
      <path d="M468 298v-34h24v34" fill="var(--paper)" />
      <path d="M2 298h556" fill="none" />
    </g>
  </svg>;
}

/** Evening silhouettes with a moon and a few lit windows, for the footer band. */
export function NightStreet() {
  // [x, top of wall, width, roof: 0 flat, 1 gable, 2 mansard]
  const houses: Array<[number, number, number, 0 | 1 | 2]> = [
    [0, 92, 104, 1], [104, 60, 86, 0], [190, 104, 128, 2], [318, 72, 92, 1], [410, 120, 150, 0], [560, 66, 96, 1],
    [656, 100, 120, 2], [776, 58, 82, 0], [858, 112, 112, 1], [970, 84, 128, 2], [1098, 70, 102, 1],
  ];
  const lit: Array<[number, number]> = [[24, 126], [70, 170], [128, 84], [160, 140], [220, 132], [282, 176], [340, 104], [378, 160], [440, 146], [510, 178], [586, 92], [624, 150], [690, 128], [740, 176], [800, 86], [828, 150], [890, 140], [1004, 112], [1060, 170], [1124, 100], [1170, 156]];
  const roof = (x: number, y: number, w: number, kind: 0 | 1 | 2) => kind === 1 ? `M${x} ${y}L${x + w / 2} ${y - w * 0.36}L${x + w} ${y}Z`
    : kind === 2 ? `M${x} ${y}L${x + 14} ${y - 26}H${x + w - 14}L${x + w} ${y}Z` : `M${x + w - 26} ${y}v-16h12v16Z`;
  return <svg className="night-street" viewBox="0 30 1200 190" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
    <circle cx="1010" cy="58" r="15" fill="#f6e7c1" />
    <circle cx="1017" cy="53" r="13" fill="#f2e8d6" />
    <g fill="var(--night)">
      {houses.map(([x, y, w, kind]) => <g key={x}><rect x={x} y={y} width={w} height={220 - y} /><path d={roof(x, y, w, kind)} /></g>)}
    </g>
    <g fill="var(--butter)">
      {lit.map(([x, y], index) => <rect key={`${x}-${y}`} x={x} y={y} width="13" height="17" rx="1.5" opacity={index % 4 === 0 ? 0.5 : 1} />)}
    </g>
  </svg>;
}

/** The brand mark: a little house with a brick roof, a lit door and the sun. */
export function BrandHouse() {
  return <svg className="home-mark" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
    <path d="M5 16 17 5l12 11v13H5Z" fill="var(--brick)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
    <rect x="13.5" y="19" width="7" height="10" rx="1.2" fill="var(--butter)" stroke="var(--ink)" strokeWidth="2" />
    <circle cx="26" cy="7.5" r="2.4" fill="var(--butter)" stroke="var(--ink)" strokeWidth="1.6" />
  </svg>;
}

export type CoverKind = 'rail' | 'family' | 'streets' | 'data' | 'energy' | 'hausgeld';

/** Drawn covers for Guide articles, one motif per topic. */
export function GuideCover({ kind }: { kind: CoverKind }) {
  return <svg className={`guide-cover is-${kind}`} viewBox="0 0 640 400" aria-hidden="true" focusable="false">
    <g {...STROKE}>
      {kind === 'energy' ? <>
        {['#3e9b4f', '#5fa84a', '#9cc03a', '#c9cf34', '#f2d23a', '#f3b03a', '#ef8a35', '#e2602f', '#c9432a'].map((color, index) => <g key={color}>
          <path d={`M90 ${60 + index * 32}h${150 + index * 34}l14 13-14 13H90Z`} fill={color} />
          <text x="104" y={`${81 + index * 32}`} fill="var(--ink)" stroke="none" fontFamily="var(--sans)" fontWeight="800" fontSize="15">{['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][index]}</text>
        </g>)}
        <path d="M470 140l40-30 40 30v120h-80Z" fill="var(--paper)" />
        <rect x="492" y="160" width="36" height="30" fill="var(--butter)" />
        <path d="M510 230v-10" fill="none" />
        <path d="M455 300h110" fill="none" />
      </> : null}
      {kind === 'hausgeld' ? <>
        <path d="M140 330V150l130-90 130 90v180Z" fill="var(--oat)" />
        <g fill="var(--sky)"><rect x="175" y="180" width="40" height="44" rx="3" /><rect x="250" y="180" width="40" height="44" rx="3" /><rect x="325" y="180" width="40" height="44" rx="3" /></g>
        <rect x="250" y="250" width="40" height="80" rx="3" fill="var(--brick)" />
        {/* A glass savings jar: the reserve, filling up coin by coin. */}
        <path d="M448 232h104v14c14 8 20 22 20 40v32a12 12 0 0 1-12 12h-120a12 12 0 0 1-12-12v-32c0-18 6-32 20-40Z" fill="#eef4f6" />
        <rect x="442" y="214" width="116" height="20" rx="5" fill="var(--brick)" />
        <g fill="var(--butter)">
          <ellipse cx="470" cy="316" rx="18" ry="7" /><ellipse cx="506" cy="316" rx="18" ry="7" /><ellipse cx="540" cy="316" rx="16" ry="7" />
          <ellipse cx="486" cy="304" rx="18" ry="7" /><ellipse cx="522" cy="304" rx="18" ry="7" />
          <ellipse cx="504" cy="292" rx="18" ry="7" />
        </g>
        <circle cx="586" cy="168" r="16" fill="var(--butter)" />
        <path d="M586 160v16M580 164h12M580 172h12" fill="none" strokeWidth="2" />
        <path d="M586 186v20" fill="none" strokeDasharray="4 5" />
        <path d="M100 330h480" fill="none" />
      </> : null}
      {kind === 'data' ? <>
        <path d="M60 330h520" fill="none" />
        {[[90, 190, 'var(--sky)'], [150, 140, 'var(--oat)'], [210, 220, 'var(--sky)'], [260, 120, 'var(--butter)'], [330, 170, 'var(--oat)'], [390, 90, 'var(--brick)'], [460, 160, 'var(--sky)'], [520, 210, 'var(--oat)']].map(([x, y, fill]) => <rect key={String(x)} x={Number(x)} y={Number(y)} width="46" height={330 - Number(y)} rx="3" fill={String(fill)} />)}
        {[[113, 170], [173, 120], [233, 200], [283, 100], [353, 150], [413, 70], [483, 140], [543, 190]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="7" fill="var(--ink)" />)}
        <path d="M113 170 173 120 233 200 283 100 353 150 413 70 483 140 543 190" fill="none" strokeDasharray="6 8" />
      </> : null}
      {kind === 'rail' ? <>
        <circle cx="510" cy="90" r="34" fill="var(--butter)" />
        <path d="M40 300h560M40 318h560" fill="none" />
        {Array.from({ length: 14 }, (_, index) => <path key={index} d={`M${60 + index * 40} 300v18`} fill="none" />)}
        <path d="M120 290v-90a30 30 0 0 1 30-30h300l60 60v60Z" fill="var(--paper)" />
        <path d="M120 250h390" fill="none" />
        <g fill="var(--sky)"><rect x="150" y="190" width="50" height="40" rx="4" /><rect x="220" y="190" width="50" height="40" rx="4" /><rect x="290" y="190" width="50" height="40" rx="4" /><rect x="360" y="190" width="50" height="40" rx="4" /></g>
        <path d="M450 170l50 50h-50Z" fill="var(--sky)" />
        <path d="M120 270h390" fill="none" stroke="var(--brick)" strokeWidth="6" />
      </> : null}
      {kind === 'family' ? <>
        <circle cx="120" cy="90" r="30" fill="var(--butter)" />
        <path d="M60 320h520" fill="none" />
        <path d="M300 320V180l90-70 90 70v140Z" fill="var(--oat)" />
        <rect x="370" y="250" width="40" height="70" rx="3" fill="var(--brick)" />
        <rect x="330" y="200" width="34" height="34" rx="3" fill="var(--sky)" />
        <rect x="416" y="200" width="34" height="34" rx="3" fill="var(--butter)" />
        <path d="M140 320v-80" fill="none" />
        <circle cx="140" cy="210" r="42" fill="var(--sage)" />
        <path d="M200 320v-50l50 50" fill="none" />
        <circle cx="200" cy="262" r="8" fill="var(--brick)" />
      </> : null}
      {kind === 'streets' ? <>
        <path d="M60 330 260 140h120l200 190Z" fill="var(--oat)" />
        <path d="M320 150v30M320 210v40M320 280v50" fill="none" strokeWidth="5" />
        <path d="M60 330V170l60-40 60 40v100" fill="var(--sky)" />
        <path d="M580 330V160l-70-40-70 40v110" fill="#e9bfa6" />
        <circle cx="200" cy="250" r="22" fill="var(--sage)" />
        <path d="M200 272v28" fill="none" />
        <circle cx="450" cy="240" r="22" fill="var(--sage)" />
        <path d="M450 262v28" fill="none" />
        <circle cx="320" cy="80" r="26" fill="var(--butter)" />
      </> : null}
    </g>
  </svg>;
}

/** Postcard landmarks for the city tiles: Fernsehturm, Frauenkirche, Kölner Dom. */
export function CityPostcard({ city }: { city: 'berlin' | 'munich' | 'cologne' }) {
  return <svg className={`city-postcard is-${city}`} viewBox="0 0 400 260" aria-hidden="true" focusable="false">
    <g {...STROKE}>
      {city === 'berlin' ? <>
        <circle cx="320" cy="64" r="20" fill="var(--butter)" />
        <path d="M196 248V120M204 248V120" fill="none" />
        <path d="M188 248l8-128h8l8 128Z" fill="var(--paper)" />
        <circle cx="200" cy="104" r="24" fill="#d9d2c6" />
        <path d="M177 100h46" fill="none" />
        <path d="M200 80V22" fill="none" strokeWidth="3" />
        <path d="M194 52h12M195 40h10" fill="none" />
        <path d="M20 248V190l30-22 30 22v58" fill="#e9bfa6" />
        <path d="M80 248V176h62v72" fill="var(--oat)" />
        <path d="M250 248V184l28-20 28 20v64" fill="var(--sky)" />
        <path d="M306 248V200h72v48" fill="#e9bfa6" />
        <g fill="var(--butter)"><rect x="36" y="200" width="12" height="14" rx="1.5" /><rect x="96" y="190" width="12" height="14" rx="1.5" /><rect x="120" y="214" width="12" height="14" rx="1.5" /><rect x="268" y="196" width="12" height="14" rx="1.5" /><rect x="324" y="214" width="12" height="14" rx="1.5" /></g>
      </> : null}
      {city === 'munich' ? <>
        <circle cx="84" cy="62" r="20" fill="var(--butter)" />
        <path d="M150 248V112h48v136M210 248V112h48v136" fill="var(--oat)" />
        <path d="M150 112c0-30 10-46 24-56 14 10 24 26 24 56Z M210 112c0-30 10-46 24-56 14 10 24 26 24 56Z" fill="var(--sage)" />
        <path d="M174 56V40M234 56V40" fill="none" />
        <path d="M198 248V150h12v98" fill="#e9bfa6" />
        <g fill="var(--sky)"><rect x="166" y="132" width="16" height="22" rx="8" /><rect x="226" y="132" width="16" height="22" rx="8" /><rect x="166" y="176" width="16" height="22" rx="8" /><rect x="226" y="176" width="16" height="22" rx="8" /></g>
        <path d="M20 248V196l40-26 40 26v52" fill="#e9bfa6" />
        <path d="M290 248V180h40l20 20v48" fill="var(--paper)" />
        <path d="M330 180v20h20" fill="none" />
        <path d="M354 248V210h30v38" fill="var(--sky)" />
      </> : null}
      {city === 'cologne' ? <>
        <circle cx="330" cy="58" r="18" fill="var(--butter)" />
        <path d="M120 248V120l20-82 20 82v128M200 248V120l20-82 20 82v128" fill="#d9d2c6" />
        <path d="M160 248V150h40v98" fill="#d9d2c6" />
        <path d="M140 38v-14M220 38v-14" fill="none" />
        <g fill="var(--sky)"><path d="M132 160v-24a8 8 0 0 1 16 0v24Z" /><path d="M212 160v-24a8 8 0 0 1 16 0v24Z" /><path d="M172 200v-28a8 8 0 0 1 16 0v28Z" /></g>
        <path d="M10 228h380" fill="none" />
        <path d="M250 228c14-30 36-30 50 0M300 228c14-30 36-30 50 0M350 228c10-22 26-26 40-16" fill="none" stroke="var(--brick)" strokeWidth="4" />
        <path d="M10 248c40-8 80 8 120 0s80-8 120 0 80 8 140 0" fill="none" stroke="var(--sky)" strokeWidth="5" />
        <path d="M20 228V186l26-18 26 18v42" fill="#e9bfa6" />
      </> : null}
      <path d="M4 248h392" fill="none" />
    </g>
  </svg>;
}
