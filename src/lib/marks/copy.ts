import { MARK_SHORTCUT } from './keys';

export const copy = {
  mark: 'Marcar o quitar la palabra seleccionada',
  markShort: 'Marcar palabra',
  panel: 'Panel de repaso',
  undo: 'Deshacer',
  learning: 'Aprendiendo',
  learned: 'Aprendidas',
  thisPage: 'Esta página',
  wholeBook: 'Todo el libro',
  study: 'Repasar estas palabras',
  still: 'Aún no',
  know: 'Me la sé',
  goTo: 'Ir a la palabra',
  learnedAction: 'Marcar como aprendida',
  deleteAction: 'Eliminar',
  showContext: 'Ver contexto',
  hideContext: 'Ocultar contexto',
  back: 'Volver a la lista',
  close: 'Cerrar panel',
  search: 'Busca tus palabras',
  selectFirst: 'Selecciona una palabra primero',
  tooLong: 'Elige una palabra o frase corta (máx. 4 palabras)',
  emptyTitle: 'Aún no hay palabras marcadas en este libro',
  emptyPageTitle: 'Ninguna palabra marcada en esta página',
  emptyLearned: 'Ya te sabes todas las palabras',
  emptySearch: (query: string) => `Ninguna palabra coincide con "${query}"`,
  studyDone: 'Eso es todo por ahora',
  pageLink: (page: number) => `Ir a la página ${page}`,
};

export function toastMarked(word: string, count: number): string {
  const noun = count === 1 ? 'vez' : 'veces';
  return `"${word}" marcada · ${count} ${noun} en esta página`;
}

export function toastUnmarked(word: string): string {
  return `"${word}" quitada`;
}

export function toastLearned(word: string): string {
  return `¡Bien! "${word}" pasa a aprendidas`;
}

export function summaryLine(words: number, learned: number): string {
  return `${words} ${words === 1 ? 'palabra' : 'palabras'} · ${learned} ${learned === 1 ? 'aprendida' : 'aprendidas'}`;
}

export function studyProgress(current: number, total: number): string {
  return `${current} de ${total}`;
}

export function studySummary(reviewed: number, known: number): string {
  return `Has repasado ${reviewed} ${reviewed === 1 ? 'palabra' : 'palabras'}. ${known} ${known === 1 ? 'pasa' : 'pasan'} a aprendidas.`;
}

export function emptyLead(): string {
  return `Selecciona una palabra que no conozcas y pulsa ${MARK_SHORTCUT}. Seguirá resaltada en todo el libro.`;
}

export function cardLabel(word: string, count: number, learned: boolean): string {
  const noun = count === 1 ? 'aparición' : 'apariciones';
  return `${word}, ${count} ${noun}, ${learned ? 'aprendida' : 'aprendiendo'}`;
}
