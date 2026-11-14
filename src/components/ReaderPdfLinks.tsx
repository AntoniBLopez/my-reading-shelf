import { useEffect } from 'react';
import * as ReactPdf from 'react-pdf';
import { applyReaderExternalLinkPolicy } from '@/lib/readerExternalLinks';

type DocumentContextHook = typeof ReactPdf.useDocumentContext;

/** Page-turn tests replace react-pdf and omit this hook. Reading the missing export throws. */
function documentContextHook(): DocumentContextHook | null {
  try {
    const hook = ReactPdf.useDocumentContext;
    return typeof hook === 'function' ? hook : null;
  } catch {
    return null;
  }
}

function ReaderPdfLinkPolicy({ useDocumentContext }: { useDocumentContext: DocumentContextHook }) {
  const context = useDocumentContext();
  useEffect(() => {
    if (context?.linkService) applyReaderExternalLinkPolicy(context.linkService);
  }, [context, useDocumentContext]);
  return null;
}

/**
 * Renders inside react-pdf `<Document>` and sets
 * `linkService.externalLinkTarget = LinkTarget.BLANK`.
 */
export function ReaderPdfLinks() {
  const useDocumentContext = documentContextHook();
  if (!useDocumentContext) return null;
  return <ReaderPdfLinkPolicy useDocumentContext={useDocumentContext} />;
}
