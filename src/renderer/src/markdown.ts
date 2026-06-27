import { marked } from 'marked'
import DOMPurify from 'dompurify'

/** Converte Markdown em HTML sanitizado (sem scripts), seguro para injetar no DOM. */
export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html)
}
