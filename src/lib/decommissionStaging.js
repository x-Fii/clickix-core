// Phase 3 Decommissioning helpers — frontend preparation only.
// No backend writes here. Equipment matching is by reliable IDs only;
// name-only inference is never used. Unmatched historical devices are
// report-only after explicit confirmation.

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Build a blank decommission item matching the EXISTING schema shape.
// Phase 3 link metadata lives in a parallel decommission_links array, NOT
// on the item itself, so the existing decommission_sections shape is
// preserved byte-for-byte.
export const blankDecommItem = () => ({
  device_type: '',
  device_name: '',
  serial_number: '',
  reason_for_decommission: '',
});

export const blankDecommSection = () => ({
  section_name: '',
  items: [blankDecommItem()],
});

// A decommission_links entry pairs a (section_index, item_index) to an
// equipment_id and tracks explicit unmatched confirmation.
export const blankDecommLink = (sectionIndex, itemIndex) => ({
  section_index: sectionIndex,
  item_index: itemIndex,
  equipment_id: '',
  is_unmatched_confirmed: false,
});

// Find the link entry for a given section/item pair.
export const getLinkFor = (links = [], sectionIndex, itemIndex) =>
  (links || []).find(l => l.section_index === sectionIndex && l.item_index === itemIndex);

// Reliable Equipment candidates for the selected Client / Site / License.
// Match by site_id first; fall back to client_id only when the site is a
// staged (temp) site with no persisted id. Never match by name.
// Returns only Active equipment, deduplicated by id.
export const getReliableEquipmentForContext = ({ equipment = [], clientId, siteId, inventoryId }) => {
  if (!siteId && !clientId) return [];
  let matched = equipment.filter(eq => eq.status === 'active' || eq.status === undefined);
  if (siteId && !String(siteId).startsWith('tmp_site_')) {
    matched = matched.filter(eq => eq.site_id === siteId);
  } else if (clientId && !String(clientId).startsWith('tmp_client_')) {
    matched = matched.filter(eq => eq.client_id === clientId);
  } else {
    return [];
  }
  if (inventoryId) {
    matched = matched.filter(eq => eq.inventory_id === inventoryId);
  }
  const seen = new Set();
  return matched.filter(eq => { if (seen.has(eq.id)) return false; seen.add(eq.id); return true; });
};

// Determine whether a link is reliably linked to an Equipment record.
export const isLinkReliablyLinked = (link) => !!link?.equipment_id && !String(link.equipment_id).startsWith('tmp_');

// Collect links for items that have manual device details entered but no
// reliable equipment_id and have not yet been explicitly confirmed unmatched.
export const getUnconfirmedLinks = (sections = [], links = []) => {
  const result = [];
  for (let si = 0; si < sections.length; si += 1) {
    const items = sections[si].items || [];
    for (let ii = 0; ii < items.length; ii += 1) {
      const item = items[ii];
      if (!item.device_name && !item.serial_number) continue;
      const link = getLinkFor(links, si, ii);
      if (!link) continue;
      if (!isLinkReliablyLinked(link) && !link.is_unmatched_confirmed) {
        result.push({ sectionIndex: si, itemIndex: ii, link, item });
      }
    }
  }
  return result;
};

// Whether every decommission item is either reliably linked or explicitly
// confirmed as unmatched. Used only to gate completion readiness; no
// automatic synchronization is triggered.
export const allDecommItemsResolved = (sections = [], links = []) =>
  getUnconfirmedLinks(sections, links).length === 0;

// Summary counts for the UI — no record writes.
export const getDecommissionSummary = (sections = [], links = [], equipment = []) => {
  let linkedCount = 0;
  let unmatchedCount = 0;
  let confirmedCount = 0;
  for (let si = 0; si < sections.length; si += 1) {
    const items = sections[si].items || [];
    for (let ii = 0; ii < items.length; ii += 1) {
      const item = items[ii];
      if (!item.device_name && !item.serial_number) continue;
      const link = getLinkFor(links, si, ii);
      if (link && isLinkReliablyLinked(link)) {
        linkedCount += 1;
      } else {
        unmatchedCount += 1;
        if (link?.is_unmatched_confirmed) confirmedCount += 1;
      }
    }
  }
  return {
    linkedCount,
    unmatchedCount,
    confirmedCount,
    totalActiveEquipment: equipment.filter(e => e.status === 'active' || e.status === undefined).length,
  };
};