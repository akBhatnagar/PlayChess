import type { ReactNode } from "react";

export type PieceCode = "K" | "Q" | "R" | "B" | "N" | "P";
export type PieceColor = "w" | "b";

const shapes: Record<PieceCode, ReactNode> = {
  P: (
    <>
      <ellipse cx="40" cy="66" rx="16" ry="6" />
      <path d="M28 60c2-8 6-12 12-12s10 4 12 12" />
      <circle cx="40" cy="32" r="11" />
    </>
  ),
  R: (
    <>
      <ellipse cx="40" cy="66" rx="18" ry="6" />
      <path d="M24 58h32l-2 6H26z" />
      <path d="M26 28h28v30H26z" />
      <path d="M24 18h8v10h-8zM36 18h8v10h-8zM48 18h8v10h-8z" />
    </>
  ),
  B: (
    <>
      <ellipse cx="40" cy="66" rx="16" ry="6" />
      <path d="M30 58c1-10 4-16 10-22 6 6 9 12 10 22z" />
      <path d="M40 14c8 6 12 14 12 22 0 4-2 8-6 10-6-8-10-14-12-22-2 8-6 14-12 22-4-2-6-6-6-10 0-8 4-16 12-22z" />
      <path d="M40 18v16" fill="none" />
    </>
  ),
  Q: (
    <>
      <ellipse cx="40" cy="66" rx="18" ry="6" />
      <path d="M24 58c2-14 8-24 16-28 8 4 14 14 16 28z" />
      <circle cx="24" cy="30" r="5" />
      <circle cx="34" cy="20" r="5" />
      <circle cx="46" cy="20" r="5" />
      <circle cx="56" cy="30" r="5" />
      <circle cx="40" cy="28" r="4" />
    </>
  ),
  K: (
    <>
      <ellipse cx="40" cy="66" rx="18" ry="6" />
      <path d="M26 58c2-16 7-26 14-30 7 4 12 14 14 30z" />
      <path d="M36 10h8v8h8v8h-8v8h-8v-8h-8v-8h8z" />
    </>
  ),
  N: (
    <>
      <ellipse cx="40" cy="66" rx="17" ry="6" />
      <path d="M22 60c2-6 8-10 14-14 2 6 2 10-2 16-8 2-12 2-12-2z" />
      <path d="M30 48c-2-10 2-18 10-24 6-4 14-4 18 2 2 4 2 8-2 10l6 6c2 6-2 12-8 14-10 2-16-2-18-8 2-2 4-2 6 0-4 2-8 0-10-4-2-2-2-4-2 4z" />
    </>
  ),
};

export function PieceGlyph({ piece, color }: { piece: PieceCode; color: PieceColor }) {
  const fill = color === "w" ? "var(--piece-white)" : "var(--piece-black)";
  const stroke = color === "w" ? "var(--piece-white-stroke)" : "var(--piece-black-stroke)";

  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className="size-[82%]">
      <g fill={fill} stroke={stroke} strokeWidth="2.4" strokeLinejoin="round">
        {shapes[piece]}
      </g>
      {piece === "N" ? <circle cx="48" cy="28" r="2.2" fill={stroke} /> : null}
    </svg>
  );
}
