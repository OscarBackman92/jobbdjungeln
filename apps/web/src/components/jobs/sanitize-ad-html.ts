const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'EM',
  'B',
  'I',
  'UL',
  'OL',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

/** Strip scripts/handlers; keep a small allowlist of formatting tags. */
export function sanitizeJobHtml(html: string): string {
  if (!html.trim()) return '';
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+=(["']).*?\1/gi, '')
      .replace(/javascript:/gi, '');
  }

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return '';

  const walk = (node: Node) => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element;
        if (!ALLOWED_TAGS.has(element.tagName)) {
          const parent = element.parentNode;
          if (!parent) continue;
          while (element.firstChild) parent.insertBefore(element.firstChild, element);
          parent.removeChild(element);
          continue;
        }
        for (const attr of [...element.attributes]) {
          element.removeAttribute(attr.name);
        }
        walk(element);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child);
      }
    }
  };

  walk(root);
  return root.innerHTML;
}

/**
 * When only plain text exists, insert breaks before common Swedish ad headings
 * so "ArbetsuppgifterDu utvecklar" becomes readable.
 */
export function formatPlainAdText(text: string): string {
  const headings = [
    'Arbetsuppgifter',
    'Om jobbet',
    'Kvalifikationer',
    'Vi erbjuder',
    'Om oss',
    'Om företaget',
    'Villkor',
    'Ansökan',
    'Övrigt',
  ];
  let result = text.replace(/\r\n/g, '\n');
  for (const heading of headings) {
    const pattern = new RegExp(`(?<!\\n)(${heading})(?=\\S)`, 'g');
    result = result.replace(pattern, `\n\n$1\n`);
  }
  return result.trim();
}
