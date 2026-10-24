import type { FigureCue } from '@/lib/rsvp/figures/types';
import type { RsvpToken } from '@/lib/rsvp/tokenize';

function figureToken(cue: FigureCue): RsvpToken {
  return { word: cue.label, orpIndex: 0, delayFactor: 1, figureStep: cue };
}

/** Insert one step after each sentence that owes a figure. The cue word itself stays a word. */
export function expandFigureSteps(tokens: readonly RsvpToken[]): RsvpToken[] {
  const steps: RsvpToken[] = [];
  for (const token of tokens) {
    if (token.figureStep) {
      steps.push(token);
      continue;
    }
    const cue = token.figureAfter;
    const { figureAfter: _ignored, ...word } = token;
    steps.push(word);
    if (cue) steps.push(figureToken(cue));
  }
  return steps;
}

/** Orphans that are not already inline steps become trailing steps, once. */
export function appendOrphanSteps(steps: readonly RsvpToken[], orphans: readonly FigureCue[]): RsvpToken[] {
  const seen = new Set(steps.flatMap((step) => (step.figureStep ? [step.figureStep.key] : [])));
  const extra = orphans.filter((cue) => !seen.has(cue.key)).map(figureToken);
  return extra.length === 0 ? [...steps] : [...steps, ...extra];
}
