export function clip(text: string, maxBytes: number): string {
  const bytes = Buffer.from(text);
  if (bytes.length <= maxBytes) return text;
  // Never split a UTF-8 code point.
  let end = maxBytes;
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString("utf8");
}
export function budgetState(
  state: Record<string, string>,
  maxBytes: number,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(state)) {
    result[key] = "";
    const free = maxBytes - Buffer.byteLength(JSON.stringify(result));
    if (free <= 0) {
      delete result[key];
      continue;
    }
    // JSON escaping can expand input; binary search the actual serialized size.
    let low = 0,
      high = Math.min(Buffer.byteLength(value), free);
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      result[key] = clip(value, mid);
      if (Buffer.byteLength(JSON.stringify(result)) <= maxBytes) low = mid;
      else high = mid - 1;
    }
    result[key] = clip(value, low);
  }
  return result;
}
// Give small pieces in full and split the remainder evenly among larger ones,
// so one large piece cannot starve the others.
export function fairClip(
  pieces: string[],
  maxBytes: number,
  separatorBytes: number,
): string[] {
  let remaining = Math.max(
    0,
    maxBytes - separatorBytes * Math.max(0, pieces.length - 1),
  );
  const result: string[] = [];
  const order = pieces
    .map((piece, index) => ({ index, size: Buffer.byteLength(piece) }))
    .sort((a, b) => a.size - b.size);
  order.forEach(({ index }, n) => {
    const clipped = clip(
      pieces[index]!,
      Math.floor(remaining / (order.length - n)),
    );
    result[index] = clipped;
    remaining -= Buffer.byteLength(clipped);
  });
  return result;
}
