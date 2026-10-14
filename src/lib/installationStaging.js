// Shared staging utilities for Phase 2 Commissioning sync.
// Stage new Client / Site / License records on the Installation Report draft
// with stable temporary IDs, so dependent dropdowns keep working after
// save/reopen without creating master records. No backend writes here.

let tempSeq = 0;
const nextTempId = (prefix) => {
  tempSeq += 1;
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `tmp_${prefix}_${stamp}_${rand}_${tempSeq}`;
};

export const createStagedClient = (fields) => ({
  temp_id: nextTempId('client'),
  company_name: fields.company_name || '',
  contact_person: fields.contact_person || '',
  pic_designation: fields.pic_designation || '',
  contact_email: fields.contact_email || '',
  contact_phone: fields.contact_phone || '',
  company_website: fields.company_website || '',
  sla: fields.sla || '',
  cms_subscriptions: fields.cms_subscriptions || [],
  hardware: fields.hardware || [],
  address: fields.address || '',
  notes: fields.notes || '',
});

export const createStagedSite = (fields) => ({
  temp_id: nextTempId('site'),
  client_id: fields.client_id || '',
  client_name: fields.client_name || '',
  staged_client_temp_id: fields.staged_client_temp_id || '',
  site_name: fields.site_name || '',
  site_location: fields.site_location || '',
  state: fields.state || '',
  region: fields.region || '',
  pic_name: fields.pic_name || '',
  pic_phone: fields.pic_phone || '',
  notes: fields.notes || '',
  status: fields.status && fields.status.length ? fields.status : ['active'],
});

export const createStagedLicense = (fields) => ({
  temp_id: nextTempId('license'),
  license_name: fields.license_name || '',
  license_number: fields.license_number || '',
  pc_sku: fields.pc_sku || '',
  tv_sku: fields.tv_sku || '',
  processor: fields.processor || '',
  anydesk: fields.anydesk || '',
  outlet: fields.outlet || '',
  client_id: fields.client_id || '',
  client_name: fields.client_name || '',
  staged_client_temp_id: fields.staged_client_temp_id || '',
  site_id: fields.site_id || '',
  site_name: fields.site_name || '',
  staged_site_temp_id: fields.staged_site_temp_id || '',
});

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Case- and whitespace-insensitive License Number uniqueness across
// existing Inventory records and already-staged licenses. Returns the
// conflicting record when found.
export const findLicenseNumberConflict = (licenseNumber, { inventoryItems = [], stagedLicenses = [] }) => {
  const target = norm(licenseNumber);
  if (!target) return null;
  for (const inv of inventoryItems) {
    if (norm(inv.license_number) === target) return { kind: 'inventory', record: inv };
  }
  for (const staged of stagedLicenses) {
    if (norm(staged.license_number) === target) return { kind: 'staged', record: staged };
  }
  return null;
};

// Normalized Client name match against existing Clients.
export const findSimilarClients = (companyName, clients = []) => {
  const target = norm(companyName);
  if (!target) return [];
  return clients.filter(c => norm(c.company_name) === target);
};

// Normalized Site name match within a client's sites.
export const findSimilarSites = (siteName, clientId, sites = []) => {
  const target = norm(siteName);
  if (!target || !clientId) return [];
  return sites.filter(s => s.client_id === clientId && norm(s.site_name) === target);
};

// Merge a comma-separated legacy Inventory string with new incoming values,
// preserving the original stored text byte-for-byte. Used at append time;
// comparison set is trimmed + case-folded only for duplicate detection.
export const appendDistinctValues = (existingString, incomingList) => {
  const existing = String(existingString || '');
  const comparisonSet = new Set(
    existing.split(/[,，]/).map(v => norm(v)).filter(Boolean)
  );
  const accepted = [];
  for (const raw of incomingList) {
    const val = String(raw || '').trim();
    if (!val) continue;
    const key = norm(val);
    if (comparisonSet.has(key)) continue;
    comparisonSet.add(key);
    accepted.push(val);
  }
  if (accepted.length === 0) return { changed: false, value: existing };
  const prefix = existing && !/[,，]\s*$/.test(existing) ? `${existing}, ` : existing;
  return { changed: true, value: `${prefix}${accepted.join(', ')}` };
};