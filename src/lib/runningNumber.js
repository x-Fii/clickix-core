import { base44 } from '@/api/base44Client';

// Assigns the lowest skipped sequence number within the current year's range,
// keeping the existing max as the ceiling; once gaps are filled it continues past the max.
// Mirrors the Service Report running-number generator so every document type
// shares one deterministic, gap-filling sequence.
export async function fetchNextRunningNumber(entityName, field, prefix, { pad = 4, limit = 1000 } = {}) {
  const all = await base44.entities[entityName].list('-created_date', limit);
  const used = new Set();
  for (const r of all) {
    const rn = String(r[field] || '');
    if (rn.startsWith(prefix)) {
      const n = parseInt(rn.slice(prefix.length), 10);
      if (!Number.isNaN(n)) used.add(n);
    }
  }
  if (used.size === 0) return `${prefix}${String(1).padStart(pad, '0')}`;
  const min = Math.min(...used);
  let next = min;
  while (used.has(next)) next++;
  return `${prefix}${String(next).padStart(pad, '0')}`;
}