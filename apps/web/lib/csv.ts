/** Parses "name,phone,address,city,state" rows; a header row is skipped. Bad rows are counted, not guessed. */
export function parseCustomerCsv(text: string) {
  const rows: { name: string; phone: string | null; address: string; city: string | null; state: string }[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
    const [name, phone, address, city, state] = cells;
    if (/^name$/i.test(name ?? '')) continue;
    if (!name || !address || !state || state.length !== 2) {
      skipped++;
      continue;
    }
    rows.push({ name, phone: phone || null, address, city: city || null, state: state.toUpperCase() });
  }
  return { rows, skipped };
}
