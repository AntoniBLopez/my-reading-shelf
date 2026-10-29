/** Reader and RSVP share one library URL: `?book=<id>`. */
export function isReaderRoute(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const book = new URLSearchParams(query).get('book');
  return typeof book === 'string' && book.length > 0;
}
