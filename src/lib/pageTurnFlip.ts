import { leafOffsetPx, turnProgress, type TurnDirection } from '@/lib/pageTurnGesture';

/** CSS perspective for the sheet. Kept in px so the fold stays in the GPU layer. */
export const FLIP_PERSPECTIVE_PX = 1400;

/** How far the grabbed corner twists, in degrees, at a full turn. */
export const FLIP_MAX_TWIST_DEG = 12;

export type FlipPose = {
  /** Signed degrees around the spine. Negative peels toward the next page. */
  angle: number;
  twist: number;
  origin: string;
  /** 0–1 crease shadow. Peaks while the sheet is edge-on. */
  shade: number;
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Pose of the curling sheet.
 * `progress` is 0 at rest and 1 when the page has turned over.
 * `grabY` is the finger's position down the page, 0 at the top.
 */
export function flipPose(progress: number, dir: TurnDirection, grabY = 0.5): FlipPose {
  const travel = clamp01(progress);
  const y = clamp(grabY, 0.08, 0.92);
  const signed = dir === 'next' ? -1 : 1;
  const angle = signed * travel * 180;
  const twist = signed * (y - 0.5) * travel * FLIP_MAX_TWIST_DEG * 2;
  const edge = dir === 'next' ? 'left' : 'right';
  const origin = `${edge} ${trim(y * 100)}%`;
  const shade = Math.sin(travel * Math.PI);
  return { angle, twist, origin, shade };
}

/** One composited transform. Angle and twist are both GPU transforms. */
export function flipTransform(pose: FlipPose): string {
  return `perspective(${FLIP_PERSPECTIVE_PX}px) rotateY(${trim(pose.angle)}deg) rotateZ(${trim(pose.twist)}deg)`;
}

export function grabRatio(clientY: number, top: number, height: number): number {
  return clamp01((clientY - top) / Math.max(1, height));
}

/** Progress of a drag, including the short rubber-band at the ends of the book. */
export function dragProgress(dx: number, width: number, dir: TurnDirection, blocked: boolean): number {
  if (!blocked) return turnProgress(dx, width, dir);
  return clamp01(Math.abs(leafOffsetPx(dx, width, dir, true)) / Math.max(1, width));
}
