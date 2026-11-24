export const dollars = (cents: number) =>
  (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "$1,250" for whole dollars, "$12.50" otherwise. */
export const shortDollars = (cents: number) => (cents % 100 === 0 ? (cents < 0 ? '-$' : '$') + Math.abs(cents / 100).toLocaleString('en-US') : dollars(cents));

export const toCents = (dollarsText: string): number | null => {
  const n = Number(dollarsText.replace(/[$,\s]/g, ''));
  return dollarsText.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
