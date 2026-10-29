import { isEdgeBlocked, targetPage, type TurnDirection } from '@/lib/pageTurnGesture';

export type TurnSlots = {
  leaf: number;
  next: number;
  prev: number;
  /** Page kept in the curl hole after the index advances. Null once the curl is gone. */
  hole: number | null;
  holeDir: TurnDirection | null;
  /** Bumped when a gesture starts so a late settle from the previous turn is ignored. */
  gen: number;
};

export type TurnAction =
  | { type: 'drag-start' }
  | { type: 'move' }
  | { type: 'drop'; dir: TurnDirection }
  | { type: 'cancel' }
  | { type: 'settle'; gen?: number };

export function slotsForPage(page: number, gen = 0): TurnSlots {
  return { leaf: page, next: page + 1, prev: page - 1, hole: null, holeDir: null, gen };
}

/** Drop the pinned hole so the neighbor under the curl is the real next or previous page. */
export function beginTurn(slots: TurnSlots, gen = slots.gen + 1): TurnSlots {
  return slotsForPage(slots.leaf, gen);
}

/** Clear the hole only if this settle still belongs to the gesture that opened it. */
export function settleTurn(slots: TurnSlots, gen: number): TurnSlots {
  if (slots.gen !== gen) return slots;
  return slotsForPage(slots.leaf, slots.gen);
}

/** The neighbor the hole is showing. A commit must not advance this a second time. */
export function shownNeighbor(slots: TurnSlots, dir: TurnDirection): number {
  if (slots.holeDir === dir && slots.hole != null) return slots.hole;
  return dir === 'next' ? slots.next : slots.prev;
}

/** Bitmap for the following turn, mounted only while the hole is still on the landed page. */
export function prefetchNeighbor(slots: TurnSlots, dir: TurnDirection): number | null {
  const shown = shownNeighbor(slots, dir);
  const ready = dir === 'next' ? slots.next : slots.prev;
  return ready === shown ? null : ready;
}

/**
 * Land on `page` without retargeting the hole.
 * The page under the curl was already `page`. Pointing the hole at `page + 1`
 * is what made the text change on drop.
 */
export function commitTurnSlots(current: TurnSlots, page: number): TurnSlots {
  if (page === current.leaf) return current;
  const holeDir: TurnDirection = page > current.leaf ? 'next' : 'prev';
  return {
    leaf: page,
    next: page + 1,
    prev: page - 1,
    hole: page,
    holeDir,
    gen: current.gen,
  };
}

export function reduceTurn(slots: TurnSlots, action: TurnAction, pageCount: number): TurnSlots {
  if (action.type === 'drag-start') return beginTurn(slots);
  if (action.type === 'move') return slots;
  if (action.type === 'cancel') return slotsForPage(slots.leaf, slots.gen);
  if (action.type === 'settle') return settleTurn(slots, action.gen ?? slots.gen);
  if (isEdgeBlocked(action.dir, slots.leaf, pageCount)) return slots;
  return commitTurnSlots(slots, targetPage(slots.leaf, action.dir));
}

export function pageDelta(before: number, after: number): number {
  return after - before;
}
