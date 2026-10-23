export const DRAG_START_PX = 12;
export const COMMIT_PROGRESS = 0.28;
export const COMMIT_VELOCITY = 0.55;
export const FLICK_MIN_PROGRESS = 0.08;
export const EDGE_RESISTANCE = 0.22;
export const GLIDE_MS = 160;

export type TurnDirection = 'next' | 'prev';

export type GesturePhase = 'pending' | 'vertical' | 'horizontal';

export function gesturePhase(dx: number, dy: number): GesturePhase {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absY > DRAG_START_PX && absY > absX) return 'vertical';
  if (absX >= DRAG_START_PX && absX > absY) return 'horizontal';
  return 'pending';
}

export function directionFromDx(dx: number): TurnDirection {
  return dx < 0 ? 'next' : 'prev';
}

export function isEdgeBlocked(dir: TurnDirection, page: number, pageCount: number): boolean {
  if (pageCount < 1) return true;
  if (dir === 'next') return page >= pageCount;
  return page <= 1;
}

/** How far the sheet should sit, in px. Unblocked drags match the finger. */
export function leafOffsetPx(dx: number, width: number, dir: TurnDirection, blocked: boolean): number {
  const limit = Math.max(1, width);
  const travel = dir === 'next' ? Math.min(0, dx) : Math.max(0, dx);
  const clamped = dir === 'next' ? Math.max(-limit, travel) : Math.min(limit, travel);
  if (!blocked) return clamped;
  const resisted = clamped * EDGE_RESISTANCE;
  const cap = Math.min(42, limit * 0.16);
  return Math.max(-cap, Math.min(cap, resisted));
}

export function turnProgress(dx: number, width: number, dir: TurnDirection): number {
  const travel = dir === 'next' ? Math.max(0, -dx) : Math.max(0, dx);
  return Math.max(0, Math.min(1, travel / Math.max(1, width)));
}

export function nextVelocity(previous: number, lastX: number, x: number, lastT: number, now: number): number {
  const dt = now - lastT;
  if (dt < 8) return previous;
  return (x - lastX) / dt;
}

export function shouldCommitTurn(args: {
  progress: number;
  vx: number;
  dir: TurnDirection;
  blocked: boolean;
}): boolean {
  if (args.blocked) return false;
  const flick = args.dir === 'next' ? args.vx < -COMMIT_VELOCITY : args.vx > COMMIT_VELOCITY;
  return args.progress >= COMMIT_PROGRESS || (flick && args.progress > FLICK_MIN_PROGRESS);
}

export function targetPage(page: number, dir: TurnDirection): number {
  return dir === 'next' ? page + 1 : page - 1;
}

export function releaseOffsetPx(width: number, dir: TurnDirection, commit: boolean): number {
  if (!commit) return 0;
  const limit = Math.max(1, width);
  return dir === 'next' ? -limit : limit;
}
