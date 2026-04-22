"use client";

const P = 2;
const f = (x: number, y: number, c: string) => `${x * P}px ${y * P}px 0 0 ${c}`;

const SK = '#fcd5b0'; // skin
const HA = '#4a3728'; // hair
const EY = '#1a1a1a'; // eyes
const MO = '#e05050'; // mouth
const SH = '#f472b6'; // shirt
const PA = '#6366f1'; // pants
const FT = '#2a2a2a'; // shoes

// body without right arm (animated separately)
const bodyBoxShadow = [
  f(2,0,HA), f(3,0,HA), f(4,0,HA), f(5,0,HA),
  f(1,1,HA), f(2,1,HA), f(3,1,HA), f(4,1,HA), f(5,1,HA), f(6,1,HA),
  f(1,2,SK), f(2,2,SK), f(3,2,SK), f(4,2,SK), f(5,2,SK), f(6,2,SK),
  f(1,3,SK), f(2,3,EY), f(3,3,SK), f(4,3,SK), f(5,3,EY), f(6,3,SK),
  f(1,4,SK), f(2,4,SK), f(3,4,SK), f(4,4,SK), f(5,4,SK), f(6,4,SK),
  f(1,5,SK), f(2,5,MO), f(3,5,MO), f(4,5,MO), f(5,5,SK), f(6,5,SK),
  f(0,6,SK),  // left arm
  f(1,6,SH), f(2,6,SH), f(3,6,SH), f(4,6,SH), f(5,6,SH), f(6,6,SH),
  f(1,7,SH), f(2,7,SH), f(3,7,SH), f(4,7,SH), f(5,7,SH), f(6,7,SH),
  f(1,8,PA), f(2,8,PA), f(3,8,PA), f(4,8,PA), f(5,8,PA), f(6,8,PA),
  f(1,9,PA), f(2,9,PA), f(4,9,PA), f(5,9,PA),
  f(1,10,FT), f(2,10,FT), f(4,10,FT), f(5,10,FT),
].join(', ');

export default function GuestbookMinimi() {
  return (
    <span
      aria-hidden="true"
      className="minimi-bob"
      style={{
        display: 'inline-block',
        position: 'relative',
        width: `${9 * P}px`,
        height: `${11 * P}px`,
        verticalAlign: 'middle',
        flexShrink: 0,
        imageRendering: 'pixelated',
      }}
    >
      {/* body */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${P}px`,
          height: `${P}px`,
          boxShadow: bodyBoxShadow,
        }}
      />
      {/* waving right arm */}
      <span
        className="minimi-wave"
        style={{
          position: 'absolute',
          left: `${7 * P}px`,
          width: `${P}px`,
          height: `${P}px`,
          backgroundColor: SK,
        }}
      />
    </span>
  );
}
