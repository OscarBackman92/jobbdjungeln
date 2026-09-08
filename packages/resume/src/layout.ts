/**
 * Column-aware text extraction from a PDF.
 *
 * A PDF has no paragraphs, only glyphs at coordinates. Reading them in stream
 * order works for a one-column document, but many CVs are laid out with a
 * sidebar — and there the stream interleaves the sidebar with the main column,
 * so a contact block lands in the middle of the work history and no amount of
 * line-level cleverness can put it right again.
 *
 * So columns are found first, from the geometry: a vertical gutter that no text
 * crosses. Each column is then read top to bottom on its own, which restores the
 * order a human reads in.
 */

export interface TextItem {
  str: string;
  /** [scaleX, skewY, skewX, scaleY, x, y] — pdf.js text transform. */
  transform: number[];
  width: number;
  height: number;
}

interface Positioned {
  text: string;
  left: number;
  right: number;
  top: number;
  height: number;
}

/** A gutter must be this wide, relative to the page, to count as a column break. */
const MIN_GUTTER_RATIO = 0.035;
/** Columns nearer than this to an edge are margins, not columns. */
const EDGE_MARGIN_RATIO = 0.15;
/** Below this, a page has too little text for a gap to mean anything. */
const MIN_ITEMS_FOR_COLUMNS = 8;
/** Items within this fraction of a line height are on the same line. */
const LINE_TOLERANCE = 0.6;
/** A horizontal gap wider than this fraction of the font size becomes a space. */
const SPACE_RATIO = 0.25;

function toPositioned(items: readonly TextItem[]): Positioned[] {
  const out: Positioned[] = [];
  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    const height = item.height || Math.abs(item.transform[3] ?? 10) || 10;
    out.push({ text: item.str, left: x, right: x + (item.width || 0), top: y, height });
  }
  return out;
}

/**
 * The x of the widest vertical strip no text crosses, or null when the page is a
 * single column.
 */
function findGutter(items: readonly Positioned[], pageWidth: number): number | null {
  if (items.length < MIN_ITEMS_FOR_COLUMNS || pageWidth <= 0) return null;

  const spans = items
    .map((item) => ({ left: item.left, right: item.right }))
    .sort((a, b) => a.left - b.left);

  let widest = { start: 0, end: 0 };
  let reach = spans[0]?.right ?? 0;

  for (const span of spans) {
    if (span.left > reach && span.left - reach > widest.end - widest.start) {
      widest = { start: reach, end: span.left };
    }
    reach = Math.max(reach, span.right);
  }

  const width = widest.end - widest.start;
  if (width < pageWidth * MIN_GUTTER_RATIO) return null;

  const centre = (widest.start + widest.end) / 2;
  const margin = pageWidth * EDGE_MARGIN_RATIO;
  if (centre < margin || centre > pageWidth - margin) return null;
  return centre;
}

/** Group a column's items into lines, top to bottom. */
function toLines(items: readonly Positioned[]): string[] {
  if (items.length === 0) return [];

  // PDF y grows upwards, so a larger `top` is higher on the page.
  const sorted = [...items].sort((a, b) => b.top - a.top || a.left - b.left);
  const lines: Positioned[][] = [];

  for (const item of sorted) {
    const line = lines.at(-1);
    const reference = line?.[0];
    const sameLine =
      reference !== undefined &&
      Math.abs(reference.top - item.top) <= reference.height * LINE_TOLERANCE;
    if (sameLine && line) line.push(item);
    else lines.push([item]);
  }

  return lines.map((line) => {
    const ordered = [...line].sort((a, b) => a.left - b.left);
    let text = '';
    let previousRight: number | null = null;
    for (const item of ordered) {
      const needsSpace =
        previousRight !== null && item.left - previousRight > item.height * SPACE_RATIO;
      if (needsSpace && !text.endsWith(' ')) text += ' ';
      text += item.text;
      previousRight = item.right;
    }
    return text.replace(/\s+/g, ' ').trim();
  });
}

export interface PageColumns {
  /** The wide column: on a CV, the actual content. */
  main: string[];
  /** The narrow column, if the page has one: contact details, skill chips. */
  aside: string[];
}

/**
 * Read one page's text items in reading order, split at the gutter when the page
 * has two columns. Main and sidebar are kept apart rather than concatenated,
 * because a section heading in one column must not capture the other's lines.
 */
export function pageToColumns(items: readonly TextItem[], pageWidth: number): PageColumns {
  const positioned = toPositioned(items);
  if (positioned.length === 0) return { main: [], aside: [] };

  const gutter = findGutter(positioned, pageWidth);
  if (gutter === null) return { main: toLines(positioned).filter(Boolean), aside: [] };

  const left = positioned.filter((item) => item.right <= gutter);
  const right = positioned.filter((item) => item.right > gutter);
  const [main, aside] = columnWidth(left) >= columnWidth(right) ? [left, right] : [right, left];

  return { main: toLines(main).filter(Boolean), aside: toLines(aside).filter(Boolean) };
}

function columnWidth(items: readonly Positioned[]): number {
  if (items.length === 0) return 0;
  const left = Math.min(...items.map((item) => item.left));
  const right = Math.max(...items.map((item) => item.right));
  return right - left;
}
