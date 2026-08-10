import { base44 } from '@/api/base44Client';

// Propagate a client company_name change to every document holding a denormalized copy.
// Documents are matched by client_id (when stored) or by the old name string.
export async function propagateClientChange(clientId, oldName, newName) {
  if (!newName || oldName === newName) return;
  const tasks = [];
  if (clientId) {
    const byId = { $set: { client_name: newName } };
    tasks.push(base44.entities.Site.updateMany({ client_id: clientId }, byId));
    tasks.push(base44.entities.ServiceReport.updateMany({ client_id: clientId }, byId));
    tasks.push(base44.entities.InstallationReport.updateMany({ client_id: clientId }, byId));
    tasks.push(base44.entities.Quotation.updateMany({ client_id: clientId }, byId));
  }
  if (oldName) {
    const byName = { $set: { client_name: newName } };
    tasks.push(base44.entities.PurchaseRequisition.updateMany({ client_name: oldName }, byName));
    tasks.push(base44.entities.Claim.updateMany({ client_name: oldName }, byName));
  }
  await Promise.allSettled(tasks);
}

// Propagate a site name/location change to every document holding a denormalized copy.
// ServiceReport and InstallationReport match by site_id; Quotation / PurchaseRequisition / Claim
// only store the site name string, so they are matched by the old name.
export async function propagateSiteChange(siteId, oldName, newName, oldLocation, newLocation) {
  const set = {};
  if (newName && newName !== oldName) set.site_name = newName;
  if (newLocation !== undefined && newLocation !== oldLocation) set.site_location = newLocation;
  if (Object.keys(set).length === 0) return;

  const tasks = [];
  if (siteId) {
    tasks.push(base44.entities.ServiceReport.updateMany({ site_id: siteId }, { $set: set }));
    tasks.push(base44.entities.InstallationReport.updateMany({ site_id: siteId }, { $set: set }));
  }
  if (set.site_name && oldName) {
    const byName = { $set: { site_name: newName } };
    tasks.push(base44.entities.Quotation.updateMany({ site_name: oldName }, byName));
    tasks.push(base44.entities.PurchaseRequisition.updateMany({ site_name: oldName }, byName));
    tasks.push(base44.entities.Claim.updateMany({ site_name: oldName }, byName));
  }
  await Promise.allSettled(tasks);
}