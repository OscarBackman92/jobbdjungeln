/**
 * Text extraction from an uploaded CV.
 *
 * The file is read into memory, parsed and thrown away — nothing is ever written
 * to disk or stored, so the only thing that survives the request is the
 * structured draft the user reviews and chooses to save.
 */

import { pageToColumns, type TextItem } from './layout.ts';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const SUPPORTED_TYPES = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt: ['text/plain', 'text/markdown'],
} as const;

export type UploadKind = keyof typeof SUPPORTED_TYPES;

export class ResumeParseError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'ResumeParseError';
  }
}

/** Which parser to use, decided by extension and confirmed by content type. */
export function detectKind(filename: string, contentType = ''): UploadKind | null {
  const name = filename.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt') || name.endsWith('.md')) return 'txt';

  for (const [kind, types] of Object.entries(SUPPORTED_TYPES)) {
    if ((types as readonly string[]).includes(contentType)) return kind as UploadKind;
  }
  return null;
}

/** PDF magic bytes; a renamed file is rejected before any parser sees it. */
function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/** DOCX is a zip archive. */
function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function extractPdf(data: Uint8Array): Promise<string> {
  if (!looksLikePdf(data)) throw new ResumeParseError('Filen ser inte ut som en PDF.');
  const { extractText: unpdfExtractText, getDocumentProxy } = await import('unpdf');

  let document: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    document = await getDocumentProxy(data);
  } catch (cause) {
    throw new ResumeParseError('Kunde inte läsa PDF:en. Är den lösenordsskyddad?', { cause });
  }

  try {
    const mains: string[] = [];
    const asides: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const [, , width = 0] = page.view as number[];
      const columns = pageToColumns(content.items as TextItem[], width);
      mains.push(...columns.main);
      asides.push(...columns.aside);
    }
    // Every page's main column first, then every sidebar. A section that runs
    // over a page break must stay contiguous, or the heading above it stops
    // applying halfway through.
    const text = [...mains, ...asides].join('\n').trim();
    if (text) return text;
  } catch {
    // Fall through: a PDF we cannot read geometrically may still yield text.
  }

  const { text } = await unpdfExtractText(document, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

async function extractDocx(data: Uint8Array): Promise<string> {
  if (!looksLikeZip(data)) throw new ResumeParseError('Filen ser inte ut som en DOCX.');
  const mammoth = await import('mammoth');
  try {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(data.buffer, data.byteOffset, data.byteLength),
    });
    return result.value;
  } catch (cause) {
    throw new ResumeParseError('Kunde inte läsa Word-dokumentet.', { cause });
  }
}

function extractTxt(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(data);
}

/** Plain text from a PDF, DOCX or TXT upload. */
export async function extractText(
  filename: string,
  data: Uint8Array,
  contentType = '',
): Promise<string> {
  if (data.byteLength === 0) throw new ResumeParseError('Filen är tom.');
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new ResumeParseError('Filen är större än 2 MB.');
  }

  const kind = detectKind(filename, contentType);
  if (!kind) {
    throw new ResumeParseError('Filformatet stöds inte. Ladda upp PDF, DOCX eller TXT.');
  }

  const text =
    kind === 'pdf'
      ? await extractPdf(data)
      : kind === 'docx'
        ? await extractDocx(data)
        : extractTxt(data);

  if (!text.trim()) {
    throw new ResumeParseError(
      'Ingen text hittades. Är CV:t en inskannad bild? Prova en textbaserad PDF.',
    );
  }
  return text;
}
