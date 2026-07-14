// Dimmed, stylised map backdrop for the non-dashboard screens (feed, create,
// approvals, profile) — mirrors the mock, which blurs a static map behind the
// glass panels rather than the live MapLibre instance.
const LAND_PATHS = [
  'M585,-20 L560,40 L600,75 L650,60 L680,95 L740,80 L790,100 L830,70 L840,-20 Z',
  'M560,150 C540,165 515,190 502,225 C490,258 478,285 470,310 C466,332 480,352 515,368 C545,380 585,388 625,396 C665,404 690,436 693,485 C695,535 685,585 668,635 C660,672 668,705 693,725 C720,742 752,730 763,698 C782,645 798,595 806,552 C818,505 836,470 858,442 C880,415 898,390 903,372 C908,352 892,342 866,336 C846,330 834,306 832,276 C830,240 838,212 843,196 C846,178 830,168 800,164 C755,158 700,150 655,144 C615,140 580,142 560,150 Z',
  'M868,160 L850,200 L862,250 L905,300 L965,320 L1010,290 L1030,235 L1000,185 L940,160 Z',
]

interface Props {
  opacity?: number
  blur?: number
  overlay?: string
  stroke?: boolean
}

export function MapBackdrop({
  opacity = 0.45,
  blur = 2,
  overlay = 'rgba(8,14,26,.5)',
  stroke = false,
}: Props) {
  return (
    <>
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity,
          filter: blur ? `blur(${blur}px)` : undefined,
        }}
      >
        <rect width="1440" height="900" fill="var(--sea-1)" />
        <g fill="var(--land)" stroke={stroke ? 'var(--coast)' : 'none'} strokeWidth="1.5">
          {LAND_PATHS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>
      {overlay && <div style={{ position: 'absolute', inset: 0, background: overlay }} />}
    </>
  )
}
