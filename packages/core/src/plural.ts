/**
 * Swedish plural agreement.
 *
 * "1 rader" and "1 aktiviteter" are the kind of thing that makes an interface
 * feel machine-generated, and they show up wherever a count is interpolated —
 * which, in an app built around counting applications, is everywhere.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Just the word, without the number in front. */
export function pluralWord(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}
