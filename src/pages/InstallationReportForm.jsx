import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Upload, X, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SignaturePad from '@/components/SignaturePad';
import { fetchNextRunningNumber } from '@/lib/runningNumber';
import PhotoPairUploader from '@/components/installation/PhotoPairUploader';
import EquipmentPicker from '@/components/installation/EquipmentPicker';
import DecommissionScopeBar from '@/components/installation/DecommissionScopeBar';
import FullSiteConfirmDialog from '@/components/installation/FullSiteConfirmDialog';
import { findLicenseNumberConflict, findSimilarClients, findSimilarSites } from '@/lib/installationStaging';
import { getReliableEquipmentForContext, getLinkFor } from '@/lib/decommissionStaging';
import { useAuth } from '@/lib/AuthContext';

const DEVICE_TYPES = ['PC', 'TV', 'Network Device', 'Cabling', 'CMS Software', 'Other'];
const RELATED_DEVICES = [
  { name: 'PC', type: 'PC' },
  { name: 'HDMI Extender', type: 'Other' },
  { name: 'HDMI', type: 'Other' },
  { name: 'LAN', type: 'Network Device' },
  { name: 'Network Switch', type: 'Network Device' },
  { name: 'Power Extension', type: 'Other' },
  { name: 'Other', type: 'Other', fillIn: true },
];

const blankItem = () => ({ device_type: '', device_name: '', serial_number: '', notes: '' });
const blankSection = () => ({ section_name: '', license_key: '', inventory_id: '', items: [] });
const blankDecommItem = () => ({ device_type: '', device_name: '', serial_number: '', reason_for_decommission: '' });
const blankDecommSection = () => ({ section_name: '', inventory_id: '', items: [blankDecommItem()] });

const parseInventoryValues = (value) => {
  if (!value) return [];
  return String(value).split(/[,，]/).map(v => v.trim()).filter(Boolean);
};

const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function InstallationReportForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!id;

  const buildDefaultForm = () => ({
    report_number: '',
    report_type: 'commissioning',
    status: 'pending',
    client_id: '', client_name: '',
    site_id: '', site_name: '', site_location: '',
    reported_by: '',
    do_number: '',
    scheduled_date: '', scheduled_end_date: '', installation_date: '', installation_finish_date: '', attend_time: '',
    attended_staff_name: '', attended_staff_id: '', attended_staff_email: '',
    work_order_number: '', quotation_number: '', site_pic_name: '',
    equipment_sections: [blankSection()],
    decommission_sections: [blankDecommSection()],
    decommission_links: [],
    decommission_scope: 'partial',
    full_site_confirmed: false,
    decommission_sync_status: 'not_started',
    equipment_installed: [],
    equipment_decommissioned: [],
    pre_job_assessment: '',
    pre_job_assessment_photos: [],
    technician_notes: '',
    supporting_photos: [],
    supporting_documents: [],
    ack_signature: '', ack_name: '', ack_phone: '', ack_company_stamp: '', ack_timestamp: '',
    submitted: false, submitted_at: '', admin_email: '',
  });

  // Load the existing report BEFORE initializing form state so the form can be
  // populated synchronously from the cached record (no default-then-seed
  // window during which user edits could be overwritten when the fetch lands).
  const { data: existing, isLoading: isLoadingExisting, isError: isErrorExisting } = useQuery({
    queryKey: ['installation-report', id],
    queryFn: () => base44.entities.InstallationReport.filter({ id }),
    enabled: isEdit,
    select: data => data[0],
  });

  // Initialize the form from the cached report when available; otherwise start
  // from defaults (a loading guard below prevents editing until seeded).
  const [form, setForm] = useState(() => (isEdit && existing ? { ...buildDefaultForm(), ...existing } : buildDefaultForm()));
  const [seeded, setSeeded] = useState(() => !isEdit || !!existing);

  const [uploading, setUploading] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  const [commissionLicenseSearch, setCommissionLicenseSearch] = useState({});
  const [commissionLicenseOpen, setCommissionLicenseOpen] = useState({});

  const [decommissionLicenseSearch, setDecommissionLicenseSearch] = useState({});
  const [decommissionLicenseOpen, setDecommissionLicenseOpen] = useState({});

  const [skuSearch, setSkuSearch] = useState({});
  const [skuOpen, setSkuOpen] = useState({});

  const [modelSearch, setModelSearch] = useState({});
  const [modelOpen, setModelOpen] = useState({});

  // Tracks the report id we've already seeded the form for, so the form is
  // populated exactly once per report (whether the data came from a fresh
  // fetch or from React Query cache) and never re-seeded while editing.
  const seededRef = useRef(null);
  const filtersSeededRef = useRef(null);

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.StaffMember.list() });
  const { data: inventoryItems = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => base44.entities.Inventory.list() });
  const { data: equipmentRecords = [] } = useQuery({ queryKey: ['equipment'], queryFn: () => base44.entities.Equipment.filter({ status: 'active' }) });

  const [siteRegionFilter, setSiteRegionFilter] = useState('');
  const [siteStateFilter, setSiteStateFilter] = useState('');
  const [showAddSite, setShowAddSite] = useState(false);

  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // Retain staged records from older drafts. New Add actions below create
  // master records immediately and do not add new staging entries.
  // These state declarations MUST come before the derived license/site
  // computations below, which reference stagedLicenses/stagedSites/stagedClients.
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [addLicenseForSection, setAddLicenseForSection] = useState(null);
  const [stagedClients, setStagedClients] = useState([]);
  const [stagedSites, setStagedSites] = useState([]);
  const [stagedLicenses, setStagedLicenses] = useState([]);

  // Phase 3 Decommissioning preparation (frontend only, no sync yet):
  // decommission_links pairs each decommission item (by section/item index)
  // to a reliably linked Equipment id, or marks it as explicitly confirmed
  // unmatched. decommission_scope + full_site_confirmed track the full-site
  // confirmation gate. No Equipment or Site status changes happen on save.
  const [showFullSiteConfirm, setShowFullSiteConfirm] = useState(false);

  // Prefer stable IDs. Legacy names must resolve to one site for this client.
  const siteLicenses = (() => {
    if (!form.client_id || !form.site_id) return [];
    const site = sites.find(s => s.id === form.site_id && s.client_id === form.client_id);
    if (!site) return [];
    const clientName = clients.find(c => c.id === form.client_id)?.company_name || form.client_name;
    const matched = inventoryItems.filter(inv => {
      if (inv.client_id && inv.client_id !== form.client_id) return false;
      if (inv.site_id) return inv.site_id === site.id;
      if (!clientName || norm(inv.client) !== norm(clientName)) return false;
      const legacyName = inv.site_name || inv.outlet;
      if (!legacyName || norm(legacyName) !== norm(site.site_name)) return false;
      return sites.filter(s => s.client_id === form.client_id && norm(s.site_name) === norm(legacyName)).length === 1;
    });
    const seen = new Set();
    return matched.filter(inv => { if (!inv.id || seen.has(inv.id)) return false; seen.add(inv.id); return true; });
  })();

  // Device/serial choices use existing Equipment records, never SKU as a serial.
  const getDecommissionEquipment = (sec) => {
    if (!form.client_id || !form.site_id || !sec.inventory_id) return [];
    return equipmentRecords.filter(eq => eq.client_id === form.client_id && eq.site_id === form.site_id && eq.inventory_id === sec.inventory_id);
  };

  // Merge staged licenses that belong to the selected site (existing or staged)
  // into the license options so they appear and are selectable in the dropdown.
  const isStagedSiteId = String(form.site_id).startsWith('tmp_site_');
  const stagedLicensesForSite = stagedLicenses.filter(l => {
    if (isStagedSiteId) return l.staged_site_temp_id === form.site_id || l.site_id === form.site_id;
    return l.site_id === form.site_id;
  });
  const licenseOptions = [...siteLicenses, ...stagedLicensesForSite]; // existing keyed by inv.id, staged by temp_id

  const getInventoryById = (invId) => inventoryItems.find(item => item.id === invId);
  const getStagedLicenseById = (tempId) => stagedLicenses.find(l => l.temp_id === tempId);

  // Resolve the inventory record backing a section: prefer the stored
  // inventory_id; fall back to a unique license-name match within the
  // current site's eligible licenses (for legacy sections without an id).
  const getSectionInventory = (sec) => {
    if (sec.staged_inventory_temp_id) return getStagedLicenseById(sec.staged_inventory_temp_id);
    if (sec.inventory_id) return getInventoryById(sec.inventory_id);
    if (!sec.section_name) return undefined;
    const matches = siteLicenses.filter(inv => norm(inv.license_name) === norm(sec.section_name));
    return matches.length === 1 ? matches[0] : undefined;
  };

  const getSkuOptions = (sec) => {
    const inventory = getSectionInventory(sec);
    return [...new Set([...parseInventoryValues(inventory?.pc_sku), ...parseInventoryValues(inventory?.tv_sku)])];
  };

  const getProcessorOptions = (sec) => parseInventoryValues(getSectionInventory(sec)?.processor);

  const getAnydeskValue = (sec) => getSectionInventory(sec)?.anydesk || '';

  // Add dialogs persist master records immediately. Existing draft staging is retained.
  const addBusyRef = useRef(false);
  const [addBusy, setAddBusy] = useState(false);
  const persistMaster = async (entity, fields, afterSave) => {
    if (addBusyRef.current) return false;
    addBusyRef.current = true;
    setAddBusy(true);
    try {
      const record = await base44.entities[entity].create(fields);
      if (!record?.id) throw new Error('The saved record did not return an ID. Refresh before retrying.');
      const key = { Client: 'clients', Site: 'sites', Inventory: 'inventory' }[entity];
      queryClient.setQueryData([key], old => [...(old || []).filter(r => r.id !== record.id), record]);
      afterSave(record);
      queryClient.invalidateQueries({ queryKey: [key] });
      toast({ title: `${entity === 'Inventory' ? 'License' : entity} added` });
      return true;
    } catch (error) {
      toast({ title: 'Unable to add record', description: error.message || 'Please try again.', variant: 'destructive' });
      return false;
    } finally { addBusyRef.current = false; setAddBusy(false); }
  };
  const stageNewClient = async (fields) => {
    if (form.report_type !== 'commissioning' || ['scheduled', 'completed', 'cancelled'].includes(form.status)) throw new Error('Adding records is available in unlocked Commissioning reports only.');
    const company_name = fields.company_name.trim();
    const latest = await base44.entities.Client.list();
    if (latest.some(c => norm(c.company_name) === norm(company_name))) throw new Error('This client already exists. Select the existing client.');
    return persistMaster('Client', { ...fields, company_name }, record => {
      setForm(f => ({ ...f, client_id: record.id, client_name: record.company_name, site_id: '', site_name: '', site_location: '', site_pic_name: '' }));
      setSiteRegionFilter(''); setSiteStateFilter(''); setShowAddClient(false);
    });
  };
  const stageNewSite = async (fields) => {
    if (form.report_type !== 'commissioning' || ['scheduled', 'completed', 'cancelled'].includes(form.status)) throw new Error('Add Site is available in unlocked Commissioning reports only.');
    const client = clients.find(c => c.id === fields.client_id);
    if (!client) throw new Error('Select a saved client first.');
    const latest = await base44.entities.Site.list();
    if (latest.some(site => site.client_id === client.id && norm(site.site_name) === norm(fields.site_name))) throw new Error('This site already exists for this client. Select the existing site.');
    return persistMaster('Site', { ...fields, site_name: fields.site_name.trim(), client_id: client.id, client_name: client.company_name }, record => {
      setForm(f => ({ ...f, client_id: client.id, client_name: client.company_name, site_id: record.id, site_name: record.site_name, site_location: record.site_location || '', site_pic_name: record.pic_name || '' }));
      setSiteRegionFilter(record.region || ''); setSiteStateFilter(record.state || ''); setShowAddSite(false);
    });
  };
  const stageNewLicense = async (fields, sectionIndex) => {
    if (form.report_type !== 'commissioning' || ['scheduled', 'completed', 'cancelled'].includes(form.status)) throw new Error('Adding records is available in unlocked Commissioning reports only.');
    const client = clients.find(c => c.id === form.client_id);
    const site = sites.find(s => s.id === form.site_id && s.client_id === client?.id);
    if (!client || !site) throw new Error('Select a saved client and site first.');
    const latest = await base44.entities.Inventory.list();
    if (findLicenseNumberConflict(fields.license_number.trim(), { inventoryItems: latest, stagedLicenses })) throw new Error('License number already exists. Use a unique license number.');
    return persistMaster('Inventory', { ...fields, license_name: fields.license_name.trim(), license_number: fields.license_number.trim(), client_id: client.id, client: client.company_name, site_id: site.id, site_name: site.site_name, outlet: fields.outlet || '' }, record => {
      setForm(f => ({ ...f, equipment_sections: (f.equipment_sections || []).map((sec, index) => index !== sectionIndex ? sec : { ...sec, section_name: record.license_name, license_key: record.license_number, inventory_id: record.id, staged_inventory_temp_id: '', items: (sec.items || []).map(item => item.device_name === 'PC' ? { ...item, anydesk: record.anydesk || '' } : item) }) }));
      setShowAddLicense(false); setAddLicenseForSection(null);
    });
  };

  // Seed the form from the loaded report exactly once per report id. Doing
  // this in an effect (rather than inside the queryFn) guarantees the seed
  // runs even when the report is served from React Query cache — which is
  // what previously caused "original info removed" on re-edit. The id guard
  // prevents refetches (new `existing` reference) from overwriting edits.
  useEffect(() => {
    if (!isEdit || !existing || seededRef.current === id) return;
    seededRef.current = id;
    setForm(() => ({ ...buildDefaultForm(), ...existing }));
    setSeeded(true);
  }, [existing, id, isEdit]);

  // Restore the Region/State filter dropdowns from the saved site once per
  // report (after both the report and the sites list are available). These
  // are filter-only UI state, not persisted on the report.
  useEffect(() => {
    if (!isEdit || !existing || filtersSeededRef.current === id || !existing.site_id || sites.length === 0) return;
    const s = sites.find(x => x.id === existing.site_id);
    if (s) {
      setSiteRegionFilter(s.region || '');
      setSiteStateFilter(s.state || '');
      filtersSeededRef.current = id;
    }
  }, [existing, sites, id, isEdit]);

  // Restore staged Client/Site/License records from the saved draft so
  // dependent dropdowns keep showing them after reopen. Staged records are
  // persisted on the report (staged_clients/sites/licenses) and only become
  // master records on official completion.
  useEffect(() => {
    if (!isEdit || !existing || seededRef.current !== id) return;
    setStagedClients(existing.staged_clients || []);
    setStagedSites(existing.staged_sites || []);
    setStagedLicenses(existing.staged_licenses || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, id, isEdit]);

  // Assign the next gap-filled IR number for new reports (matches the
  // Service Report running-number sequence behavior).
  useEffect(() => {
    if (isEdit) return;
    let active = true;
    const yy = String(new Date().getFullYear()).slice(-2);
    fetchNextRunningNumber('InstallationReport', 'report_number', `IR${yy}-`).then(num => {
      if (active) setForm(f => ({ ...f, report_number: num }));
    });
    return () => { active = false; };
  }, [isEdit]);

  const regionOptions = [...new Set(sites.map(s => s.region).filter(Boolean))].sort();
  const stateOptions = [...new Set(sites.filter(s => !siteRegionFilter || s.region === siteRegionFilter).map(s => s.state).filter(Boolean))].sort();

  const isStagedClientId = String(form.client_id).startsWith('tmp_client_');
  const filteredSites = sites.filter(s =>
    (form.site_id && s.id === form.site_id) ||
    ((!form.client_id || s.client_id === form.client_id) &&
    (!siteRegionFilter || s.region === siteRegionFilter) &&
    (!siteStateFilter || s.state === siteStateFilter))
  );
  // Staged sites belong to the selected client (existing or staged).
  const filteredStagedSites = stagedSites.filter(s => {
    if (isStagedClientId) return s.staged_client_temp_id === form.client_id || s.client_id === form.client_id;
    return s.client_id === form.client_id;
  }).filter(s =>
    (!siteRegionFilter || s.region === siteRegionFilter) &&
    (!siteStateFilter || s.state === siteStateFilter)
  );

  const mutation = useMutation({
    mutationFn: data => isEdit
      ? base44.entities.InstallationReport.update(id, data)
      : base44.entities.InstallationReport.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['installation-reports']);
      queryClient.invalidateQueries(['installation-report', result.id || id]);
      toast({ title: isEdit ? 'Report updated' : 'Report created' });
      navigate(`/installation/${result.id || id}`);
    },
    onError: (err) => {
      toast({ title: 'Failed to save report', description: err?.message || 'Please check your inputs and try again.', variant: 'destructive' });
    },
  });

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const toDatetimeLocal = (v) => v ? (v.length === 10 ? `${v}T00:00` : v) : '';

  // Equipment sections helpers (commissioning)
  const addSection = () => set('equipment_sections', [...(form.equipment_sections || []), blankSection()]);
  const removeSection = (si) => set('equipment_sections', form.equipment_sections.filter((_, idx) => idx !== si));
  const updateSectionName = (si, val) => {
    const arr = [...form.equipment_sections];
    arr[si] = { ...arr[si], section_name: val };
    set('equipment_sections', arr);
  };
  const updateSectionLicenseKey = (si, val) => {
    const arr = [...form.equipment_sections];
    arr[si] = { ...arr[si], license_key: val };
    set('equipment_sections', arr);
  };

  const selectCommissionLicense = (si, invId) => {
    // Staged license selected by temp_id; existing by inventory id.
    const isStaged = String(invId).startsWith('tmp_license_');
    const selected = isStaged ? getStagedLicenseById(invId) : getInventoryById(invId);
    if (!selected) return;

    setForm(f => ({
      ...f,
      equipment_sections: (f.equipment_sections || []).map((sec, index) =>
        index === si
          ? {
              ...sec,
              section_name: selected.license_name || '',
              license_key: selected.license_number || '',
              inventory_id: isStaged ? '' : selected.id,
              staged_inventory_temp_id: isStaged ? selected.temp_id : '',
              items: (sec.items || []).map(item =>
                item.device_name === 'PC'
                  ? { ...item, anydesk: selected.anydesk || '' }
                  : item
              ),
            }
          : sec
      ),
    }));
  };

  const addItemToSection = (si) => {
    const arr = [...form.equipment_sections];
    arr[si] = { ...arr[si], items: [...(arr[si].items || []), blankItem()] };
    set('equipment_sections', arr);
  };
  const removeItemFromSection = (si, ii) => {
    const arr = [...form.equipment_sections];
    arr[si] = { ...arr[si], items: arr[si].items.filter((_, idx) => idx !== ii) };
    set('equipment_sections', arr);
  };
  const updateSectionItem = (si, ii, field, val) => {
    setForm(f => {
      const arr = f.equipment_sections.map((sec, s) => {
        if (s !== si) return sec;
        const items = sec.items.map((item, i) => i === ii ? { ...item, [field]: val } : item);
        return { ...sec, items };
      });
      return { ...f, equipment_sections: arr };
    });
  };
  const toggleRelatedDevice = (si, device) => {
    setForm(f => {
      const arr = f.equipment_sections.map((sec, s) => {
        if (s !== si) return sec;
        const items = [...(sec.items || [])];
        const existingIdx = device.fillIn
          ? items.findIndex(it => it.device_type === device.type && it.device_name === '')
          : items.findIndex(it => it.device_name === device.name);
        if (existingIdx >= 0) {
          items.splice(existingIdx, 1);
        } else {
          items.push({
            device_type: device.type,
            device_name: device.fillIn ? '' : device.name,
            serial_number: '',
            model: '',
            sku: '',
            anydesk: device.name === 'PC' ? getAnydeskValue(sec) : '',
            length: '',
            quantity: '',
            num_ports: '',
            num_gang: '',
            notes: ''
          });
        }
        return { ...sec, items };
      });
      return { ...f, equipment_sections: arr };
    });
  };
  // Decommission sections helpers
  // Phase 3: decommission_links + scope helpers. Links live in a parallel
  // array keyed by (section_index, item_index); the existing decommission
  // item shape is unchanged.
  const isFullSite = (form.decommission_scope || 'partial') === 'full_site';
  const setDecommissionScope = (scope) => {
    return; // Temporarily disabled
    
    setForm(f => ({ ...f, decommission_scope: scope, full_site_confirmed: scope === 'full_site' ? f.full_site_confirmed : false }));
    if (scope === 'full_site') setShowFullSiteConfirm(true);
  };
  const confirmFullSite = () => setForm(f => ({ ...f, full_site_confirmed: true }));
  const ensureLink = (si, ii) => {
    setForm(f => {
      const links = f.decommission_links || [];
      if (links.some(l => l.section_index === si && l.item_index === ii)) return f;
      return { ...f, decommission_links: [...links, { section_index: si, item_index: ii, equipment_id: '', is_unmatched_confirmed: false }] };
    });
  };
  const linkEquipment = (si, ii, equipmentId) => {
    setForm(f => {
      const links = (f.decommission_links || []).filter(l => !(l.section_index === si && l.item_index === ii));
      // When linking to a real Equipment record, prefill the item's descriptive
      // fields from it so the report shows what was removed. Unlinking clears
      // only the link, preserving the user's manually entered details.
      const eq = equipmentId ? equipmentRecords.find(e => e.id === equipmentId) : null;
      const sections = (f.decommission_sections || []).map((sec, s) => {
        if (s !== si) return sec;
        const items = (sec.items || []).map((item, i) => {
          if (i !== ii) return item;
          if (!eq) return item;
          return {
            ...item,
            device_type: eq.device_type || item.device_type,
            device_name: eq.device_name || item.device_name,
            serial_number: eq.serial_number || item.serial_number,
          };
        });
        return { ...sec, items };
      });
      return {
        ...f,
        decommission_sections: sections,
        decommission_links: [...links, { section_index: si, item_index: ii, equipment_id: equipmentId || '', is_unmatched_confirmed: false }],
      };
    });
  };
  const confirmUnmatched = (si, ii) => {
    setForm(f => {
      const links = (f.decommission_links || []).filter(l => !(l.section_index === si && l.item_index === ii));
      return { ...f, decommission_links: [...links, { section_index: si, item_index: ii, equipment_id: '', is_unmatched_confirmed: true }] };
    });
  };

  const addDecommSection = () => set('decommission_sections', [...(form.decommission_sections || []), blankDecommSection()]);
  const removeDecommSection = (si) => set('decommission_sections', (form.decommission_sections || []).filter((_, idx) => idx !== si));
  const updateDecommSectionName = (si, val) => {
    const arr = [...(form.decommission_sections || [])];
    arr[si] = { ...arr[si], section_name: val };
    set('decommission_sections', arr);
  };
  const selectDecommissionLicense = (si, invId) => {
    const selectedInventory = getInventoryById(invId);
    if (!selectedInventory) return;
    const arr = [...(form.decommission_sections || [])];
    arr[si] = { ...arr[si], section_name: selectedInventory.license_name || '', inventory_id: selectedInventory.id };
    set('decommission_sections', arr);
  };
  const addDecommItemToSection = (si) => {
    const arr = [...(form.decommission_sections || [])];
    arr[si] = { ...arr[si], items: [...(arr[si].items || []), blankDecommItem()] };
    set('decommission_sections', arr);
  };
  const removeDecommItemFromSection = (si, ii) => {
    const arr = [...(form.decommission_sections || [])];
    arr[si] = { ...arr[si], items: arr[si].items.filter((_, idx) => idx !== ii) };
    set('decommission_sections', arr);
  };
  const updateDecommSectionItem = (si, ii, field, val) => {
    setForm(f => {
      const arr = (f.decommission_sections || []).map((sec, s) => {
        if (s !== si) return sec;
        const items = sec.items.map((item, i) => i === ii ? { ...item, [field]: val } : item);
        return { ...sec, items };
      });
      return { ...f, decommission_sections: arr };
    });
  };
  const handleMultiPhotoUpload = async (e, field) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const selected = files.slice(0, 10);
    if (files.length > 10) toast({ title: 'Maximum 10 photos at once', variant: 'destructive' });
    setUploading(true);
    const uploaded = [];
    for (const file of selected) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push(file_url);
    }
    setForm(f => ({ ...f, [field]: [...(f[field] || []), ...uploaded] }));
    setUploading(false);
    e.target.value = '';
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, supporting_documents: [...(f.supporting_documents || []), file_url] }));
    setUploading(false);
    e.target.value = '';
  };

  const handleStampUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingStamp(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, ack_company_stamp: file_url }));
    setUploadingStamp(false);
    e.target.value = '';
  };

  const handleSignatureChange = async (dataUrl) => {
    if (!dataUrl) { set('ack_signature', ''); return; }
    // Convert base64 dataURL to a File and upload to avoid storing large blobs in the entity
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'signature.png', { type: 'image/png' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, ack_signature: file_url, ack_timestamp: new Date().toISOString() }));
  };

  const NUMBER_FIELDS = ['quantity', 'num_ports', 'num_gang'];
  const sanitizeItem = (item) => {
    const out = { ...item };
    NUMBER_FIELDS.forEach((k) => {
      if (out[k] === '' || out[k] === null || out[k] === undefined) {
        delete out[k];
      } else {
        const n = Number(out[k]);
        out[k] = Number.isNaN(n) ? undefined : n;
        if (out[k] === undefined) delete out[k];
      }
    });
    return out;
  };
  const sanitize = (data) => ({
    ...data,
    equipment_sections: (data.equipment_sections || []).map(sec => ({ ...sec, items: (sec.items || []).map(sanitizeItem) })),
    decommission_sections: (data.decommission_sections || []).map(sec => ({ ...sec, items: (sec.items || []).map(sanitizeItem) })),
    equipment_installed: (data.equipment_installed || []).map(sanitizeItem),
    equipment_decommissioned: (data.equipment_decommissioned || []).map(sanitizeItem),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(sanitize(form));
  };

  const sectionClass = 'bg-card border border-border rounded-xl p-5 space-y-4';
  const rowClass = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
  const jobLocked = form.status === 'scheduled' || form.status === 'completed' || form.status === 'cancelled';
  const isImage = (url) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url || '');

  if (isEdit && isLoadingExisting) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isEdit && (isErrorExisting || (!isLoadingExisting && !existing))) return (
    <div className="p-6 text-center text-muted-foreground">Report not found.</div>
  );

  if (isEdit && !seeded) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/installation')}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold font-heading">{isEdit ? 'Edit Installation Report' : 'New Installation Report'}</h1>
          <p className="text-xs text-muted-foreground font-mono">{form.report_number}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Job Detail */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Job Detail</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </div>
          <fieldset disabled={jobLocked} className="space-y-4 m-0 p-0 border-0">
            <div className={rowClass}>
              <div className="space-y-1">
                <Label>Report Type</Label>
                <Select value={form.report_type} onValueChange={v => set('report_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commissioning">Commissioning</SelectItem>
                    <SelectItem value="decommissioning">Decommissioning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quotation Number</Label>
                <Input value={form.quotation_number} onChange={e => set('quotation_number', e.target.value)} placeholder="QTN-XXXX" />
              </div>
              <div className="space-y-1">
                <Label>Schedule Start Date</Label>
                <Input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Schedule End Date</Label>
                <Input type="date" value={form.scheduled_end_date} min={form.scheduled_date || undefined} onChange={e => set('scheduled_end_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Created By</Label>
                <Select value={form.reported_by || undefined} onValueChange={v => set('reported_by', v)}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>{staff.filter(s => s.is_active).map(s => <SelectItem key={s.id} value={s.name}>{s.name} ({s.role})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className={rowClass}>
              <div className="space-y-1">
                <Label>Client</Label>
                <div className="flex gap-2">
                  <Select value={form.client_id} onValueChange={v => {
                    if (String(v).startsWith('tmp_client_')) {
                      const staged = stagedClients.find(s => s.temp_id === v);
                      setForm(f => ({ ...f, client_id: v, client_name: staged?.company_name || '', site_id: '', site_name: '', site_location: '', site_pic_name: '' }));
                      return;
                    }
                    const c = clients.find(x => x.id === v);
                    setForm(f => ({ ...f, client_id: v, client_name: c?.company_name || '', site_id: '', site_name: '', site_location: '', site_pic_name: '' }));
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                      {stagedClients.map(c => <SelectItem key={c.temp_id} value={c.temp_id}>{c.company_name} (staged)</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.report_type === 'commissioning' && (
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setShowAddClient(true)} disabled={jobLocked}>
                    <Plus size={14} /> Add Client
                  </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Region</Label>
                <Select value={siteRegionFilter || undefined} onValueChange={v => { setSiteRegionFilter(v); setSiteStateFilter(''); }}>
                  <SelectTrigger><SelectValue placeholder="All regions" /></SelectTrigger>
                  <SelectContent>
                    {regionOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {siteRegionFilter && <button type="button" onClick={() => { setSiteRegionFilter(''); setSiteStateFilter(''); }} className="text-xs text-muted-foreground hover:text-foreground">✕ Clear</button>}
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Select value={siteStateFilter || undefined} onValueChange={v => { setSiteStateFilter(v); }}>
                  <SelectTrigger><SelectValue placeholder="All states" /></SelectTrigger>
                  <SelectContent>
                    {stateOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {siteStateFilter && <button type="button" onClick={() => setSiteStateFilter('')} className="text-xs text-muted-foreground hover:text-foreground">✕ Clear</button>}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>Site / Outlet</Label>
                  {form.report_type === 'commissioning' && (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddSite(true)} disabled={jobLocked}>
                      <Plus size={14} /> Add Site
                    </Button>
                  )}
                </div>
                <Select value={form.site_id} onValueChange={v => {
                  if (String(v).startsWith('tmp_site_')) {
                    const staged = stagedSites.find(s => s.temp_id === v);
                    setForm(f => ({ ...f, site_id: v, site_name: staged?.site_name || '', site_location: staged?.site_location || '', site_pic_name: staged?.pic_name || '' }));
                    return;
                  }
                  const s = sites.find(x => x.id === v);
                  setForm(f => ({ ...f, site_id: v, site_name: s?.site_name || '', site_location: s?.site_location || '', site_pic_name: s?.pic_name || '' }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.site_name}{s.state ? ` — ${s.state}` : ''}</SelectItem>)}
                  {filteredStagedSites.map(s => <SelectItem key={s.temp_id} value={s.temp_id}>{s.site_name} (staged)</SelectItem>)}
                </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Site Location <span className="text-muted-foreground/60 normal-case font-normal lowercase tracking-normal">(autofill)</span></Label>
                <Input value={form.site_location} readOnly placeholder="Autofilled from selected site" className="bg-muted/40 cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <Label>Site PIC Name <span className="text-muted-foreground/60 normal-case font-normal lowercase tracking-normal">(autofill)</span></Label>
                <Input value={form.site_pic_name} readOnly placeholder="Autofilled from selected site" className="bg-muted/40 cursor-not-allowed" />
              </div>
            </div>
          </fieldset>
        </div>

        <AddClientDialog
          open={showAddClient && form.report_type === 'commissioning' && !jobLocked}
          onOpenChange={setShowAddClient}
          clients={clients}
          busy={addBusy}
          onConfirm={(fields) => stageNewClient(fields)}
        />
        <AddSiteDialog
          open={showAddSite && form.report_type === 'commissioning' && !jobLocked}
          onOpenChange={setShowAddSite}
          clients={clients}
          stagedClients={stagedClients}
          sites={sites}
          busy={addBusy}
          isAdmin={isAdmin}
          linkedClientId={form.client_id}
          linkedStagedClientTempId={isStagedClientId ? form.client_id : ''}
          onConfirm={(fields) => stageNewSite(fields)}
        />
        <AddLicenseDialog
          open={showAddLicense && form.report_type === 'commissioning' && !jobLocked}
          onOpenChange={(o) => { setShowAddLicense(o); if (!o) setAddLicenseForSection(null); }}
          inventoryItems={inventoryItems}
          busy={addBusy}
          stagedLicenses={stagedLicenses}
          linkedClientId={form.client_id}
          linkedClientName={form.client_name}
          linkedStagedClientTempId={isStagedClientId ? form.client_id : ''}
          linkedSiteId={form.site_id}
          linkedSiteName={form.site_name}
          linkedStagedSiteTempId={isStagedSiteId ? form.site_id : ''}
          onConfirm={(fields) => stageNewLicense(fields, addLicenseForSection)}
        />

        {/* Schedule & Attendance */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Schedule & Attendance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Installation Start Date</Label>
              <Input type="datetime-local" value={toDatetimeLocal(form.installation_date)} onChange={e => set('installation_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Installation Finish Date</Label>
              <Input type="datetime-local" value={toDatetimeLocal(form.installation_finish_date)} onChange={e => set('installation_finish_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>DO Number</Label>
              <Input value={form.do_number} onChange={e => set('do_number', e.target.value)} placeholder="DO-XXXX" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Technician</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 border border-input rounded-md bg-background p-2 max-h-36 overflow-y-auto content-start">
                {staff.length === 0 && <p className="text-xs text-muted-foreground">No staff found</p>}
                {staff.map(s => {
                  const selectedIds = form.attended_staff_id ? form.attended_staff_id.split(',').filter(Boolean) : [];
                  const checked = selectedIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                      <input type="checkbox" checked={checked} onChange={() => {
                        const next = checked ? selectedIds.filter(id => id !== s.id) : [...selectedIds, s.id];
                        const selected = staff.filter(x => next.includes(x.id));
                        setForm(f => ({
                          ...f,
                          attended_staff_id: next.join(','),
                          attended_staff_name: selected.map(x => x.name).join(', '),
                          attended_staff_email: selected.map(x => x.email || '').join(', '),
                        }));
                      }} className="accent-primary" />
                      <span className="text-sm">{s.name}</span>
                      {s.staff_id && <span className="text-xs text-muted-foreground font-mono">({s.staff_id})</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Installed — Section-based (commissioning) */}
        {form.report_type === 'commissioning' && (
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Equipment Installed</h2>
              <Button type="button" size="sm" variant="outline" onClick={addSection}>
                <Plus size={14} className="mr-1" /> Add Section
              </Button>
            </div>
            {(form.equipment_sections || []).map((sec, si) => (
              <div key={si} className="border border-primary/30 rounded-lg p-4 space-y-3 bg-muted/10">
                {/* Section header */}
                <div className="flex items-center gap-2">
                  
                  <div className="relative flex-1">
                  <div className="relative">
                    <Input
                      className="h-8 text-sm font-semibold pr-9"
                      value={commissionLicenseSearch[si] ?? sec.section_name ?? ''}
                      onClick={() => {
                        setCommissionLicenseOpen(prev => ({ ...prev, [si]: !prev[si] }));
                        setCommissionLicenseSearch(prev => ({ ...prev, [si]: prev[si] ?? '' }));
                      }}
                      onChange={e => {
                        setCommissionLicenseSearch(prev => ({ ...prev, [si]: e.target.value }));
                        setCommissionLicenseOpen(prev => ({ ...prev, [si]: true }));
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setCommissionLicenseSearch(prev => ({ ...prev, [si]: undefined }));
                          setCommissionLicenseOpen(prev => ({ ...prev, [si]: false }));
                        }, 150);
                      }}
                      placeholder="Select license"
                    />

                    <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform ${commissionLicenseOpen[si] ? 'rotate-180' : ''}`} />
                  </div>

                  {commissionLicenseOpen[si] && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      <button
                        type="button"
                        disabled={jobLocked || form.report_type !== 'commissioning'}
                        onClick={() => {
                          setAddLicenseForSection(si);
                          setShowAddLicense(true);
                          setCommissionLicenseOpen(prev => ({ ...prev, [si]: false }));
                          setCommissionLicenseSearch(prev => ({ ...prev, [si]: undefined }));
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-medium text-primary hover:bg-primary/10 border-b border-border sticky top-0 bg-popover"
                      >
                        + Add New License…
                      </button>
                      {licenseOptions.filter(inv =>
                        String(inv.license_name || '').toLowerCase().includes((commissionLicenseSearch[si] || '').toLowerCase())
                      ).length > 0 ? (
                        licenseOptions
                          .filter(inv => String(inv.license_name || '').toLowerCase().includes((commissionLicenseSearch[si] || '').toLowerCase()))
                          .map(inv => (
                            <button
                              key={inv.id || inv.temp_id}
                              type="button"
                              onClick={() => {
                                selectCommissionLicense(si, inv.id || inv.temp_id);
                                setCommissionLicenseSearch(prev => ({ ...prev, [si]: undefined }));
                                setCommissionLicenseOpen(prev => ({ ...prev, [si]: false }));
                              }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                            >
                              <span className="font-medium">{inv.license_name}</span>
                              {inv.license_number && <span className="text-muted-foreground font-mono ml-2">{inv.license_number}</span>}
                              {inv.temp_id && <span className="text-muted-foreground ml-1">(staged)</span>}
                            </button>
                          ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {form.site_id ? 'No license found for this site' : 'Select a site to choose a license'}
                        </div>
                      )}
                    </div>
                  )}
                </div>


                  <button type="button" onClick={() => removeSection(si)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 pl-2">
                  <Label className="text-xs whitespace-nowrap">License Key</Label>
                  <Input
                    className="h-8 text-xs font-mono flex-1 bg-muted/40 cursor-not-allowed"
                    value={sec.license_key || ''}
                    readOnly
                    placeholder="Autofilled from selected license"
                  />
                </div>
                {/* Items within section */}
                <div className="space-y-3 pl-2 border-l-2 border-border">
                  {/* Related devices quick select */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-xs text-muted-foreground">Related devices</span>
                    {RELATED_DEVICES.map(dev => {
                      const checked = dev.fillIn
                        ? (sec.items || []).some(it => it.device_type === dev.type && it.device_name === '')
                        : (sec.items || []).some(it => it.device_name === dev.name);
                      return (
                        <label key={dev.name} className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                          <input type="checkbox" checked={checked} onChange={() => toggleRelatedDevice(si, dev)} className="accent-primary" />
                          {dev.fillIn ? `${dev.name} (fill in)` : dev.name}
                        </label>
                      );
                    })}
                  </div>
                  {(sec.items || []).map((item, ii) => (
                    <div key={ii} className="border border-border rounded-lg p-3 space-y-2 relative bg-card">
                      <button type="button" onClick={() => removeItemFromSection(si, ii)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                        <Trash2 size={12} />
                      </button>
                      {item.device_name === 'PC' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1 relative">
                  <Label className="text-xs">SKU</Label>

                  <div className="relative">
                    <Input
                      className="h-8 text-xs pr-9"
                      value={skuSearch[`${si}-${ii}`] ?? item.sku ?? ''}
                      onClick={() => {
                        const key = `${si}-${ii}`;
                        setSkuOpen(prev => ({ ...prev, [key]: !prev[key] }));
                        setSkuSearch(prev => ({ ...prev, [key]: prev[key] ?? '' }));
                      }}
                      onChange={e => {
                        const key = `${si}-${ii}`;
                        setSkuSearch(prev => ({ ...prev, [key]: e.target.value }));
                        setSkuOpen(prev => ({ ...prev, [key]: true }));
                        updateSectionItem(si, ii, 'sku', '');
                      }}
                      placeholder="Select SKU"

                      onBlur={() => {
                        const key = `${si}-${ii}`;
                        setTimeout(() => {
                          setSkuSearch(prev => ({ ...prev, [key]: undefined }));
                          setSkuOpen(prev => ({ ...prev, [key]: false }));
                        }, 150);
                      }}
                    />

                    <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform ${skuOpen[`${si}-${ii}`] ? 'rotate-180' : ''}`} />
                  </div>

                  {skuOpen[`${si}-${ii}`] && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      {getSkuOptions(sec)
                        .filter(sku => sku.toLowerCase().includes((skuSearch[`${si}-${ii}`] || '').toLowerCase()))
                        .map(sku => (
                          <button
                            key={sku}
                            type="button"
                            onClick={() => {
                              const key = `${si}-${ii}`;
                              updateSectionItem(si, ii, 'sku', sku);
                              setSkuSearch(prev => ({ ...prev, [key]: undefined }));
                              setSkuOpen(prev => ({ ...prev, [key]: false }));
                            }}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                          >
                            {sku}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                          <div className="space-y-1 relative">
          <Label className="text-xs">Model</Label>

          <div className="relative">
            <Input
              className="h-8 text-xs pr-9"
              value={modelSearch[`${si}-${ii}`] ?? item.model ?? ''}
              onClick={() => {
                const key = `${si}-${ii}`;
                setModelOpen(prev => ({ ...prev, [key]: !prev[key] }));
                setModelSearch(prev => ({ ...prev, [key]: prev[key] ?? item.model ?? '' }));
              }}
              onChange={e => {
                const key = `${si}-${ii}`;
                setModelSearch(prev => ({ ...prev, [key]: e.target.value }));
                setModelOpen(prev => ({ ...prev, [key]: true }));
                updateSectionItem(si, ii, 'model', e.target.value);
              }}
              onBlur={() => {
                const key = `${si}-${ii}`;
                setTimeout(() => {
                  setModelSearch(prev => ({ ...prev, [key]: undefined }));
                  setModelOpen(prev => ({ ...prev, [key]: false }));
                }, 150);
              }}
              placeholder="Select or enter model"
            />

            <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform ${modelOpen[`${si}-${ii}`] ? 'rotate-180' : ''}`} />
          </div>

          {modelOpen[`${si}-${ii}`] && (
            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {getProcessorOptions(sec)
                .filter(model => model.toLowerCase().includes((modelSearch[`${si}-${ii}`] || '').toLowerCase()))
                .map(model => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => {
                      const key = `${si}-${ii}`;
                      updateSectionItem(si, ii, 'model', model);
                      setModelSearch(prev => ({ ...prev, [key]: undefined }));
                      setModelOpen(prev => ({ ...prev, [key]: false }));
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {model}
                  </button>
                ))}
            </div>
          )}
        </div>
                         <div className="space-y-1">
                            <Label className="text-xs">Anydesk</Label>
                            <Input
                              className="h-8 text-xs bg-muted/40 cursor-not-allowed"
                              value={item.anydesk || getAnydeskValue(sec)}
                              readOnly
                              placeholder="Autofilled from selected license"
                            />
                          </div>

                        </div>
                      )}

                      {item.device_name === 'HDMI Extender' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1 relative">
                            <Label className="text-xs">SKU</Label>

                            <div className="relative">
                              <Input
                                className="h-8 text-xs pr-9"
                                value={skuSearch[`${si}-${ii}`] ?? item.sku ?? ''}
                                onClick={() => {
                                  const key = `${si}-${ii}`;
                                  setSkuOpen(prev => ({ ...prev, [key]: !prev[key] }));
                                  setSkuSearch(prev => ({ ...prev, [key]: prev[key] ?? '' }));
                                }}
                                onChange={e => {
                                  const key = `${si}-${ii}`;
                                  setSkuSearch(prev => ({ ...prev, [key]: e.target.value }));
                                  setSkuOpen(prev => ({ ...prev, [key]: true }));
                                  updateSectionItem(si, ii, 'sku', '');
                                }}
                                placeholder="Select SKU"

                                onBlur={() => {
                                  const key = `${si}-${ii}`;
                                  setTimeout(() => {
                                    setSkuSearch(prev => ({ ...prev, [key]: undefined }));
                                    setSkuOpen(prev => ({ ...prev, [key]: false }));
                                  }, 150);
                                }}
                              />

                              <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform ${skuOpen[`${si}-${ii}`] ? 'rotate-180' : ''}`} />
                            </div>

                            {skuOpen[`${si}-${ii}`] && (
                              <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                                {getSkuOptions(sec)
                                  .filter(sku => sku.toLowerCase().includes((skuSearch[`${si}-${ii}`] || '').toLowerCase()))
                                  .map(sku => (
                                    <button
                                      key={sku}
                                      type="button"
                                      onClick={() => {
                                        const key = `${si}-${ii}`;
                                        updateSectionItem(si, ii, 'sku', sku);
                                        setSkuSearch(prev => ({ ...prev, [key]: undefined }));
                                        setSkuOpen(prev => ({ ...prev, [key]: false }));
                                      }}
                                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                                    >
                                      {sku}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Model</Label>
                              <Input className="h-8 text-xs" value={item.model || ''} onChange={e => updateSectionItem(si, ii, 'model', e.target.value)} placeholder="Model" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
                            <div className="space-y-1.5">
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                                <input type="checkbox" checked={!!item.hdmi_rx} onChange={e => updateSectionItem(si, ii, 'hdmi_rx', e.target.checked)} className="accent-primary" />
                                <span className="font-medium">RX HDMI</span>
                              </label>
                              {item.hdmi_rx && (
                                <div className="pl-5">
                                  <Label className="text-xs">Length</Label>
                                  <Input className="h-8 text-xs" value={item.hdmi_rx_length || ''} onChange={e => updateSectionItem(si, ii, 'hdmi_rx_length', e.target.value)} placeholder="Length" />
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-primary transition-colors">
                                <input type="checkbox" checked={!!item.hdmi_tx} onChange={e => updateSectionItem(si, ii, 'hdmi_tx', e.target.checked)} className="accent-primary" />
                                <span className="font-medium">TX HDMI</span>
                              </label>
                              {item.hdmi_tx && (
                                <div className="pl-5">
                                  <Label className="text-xs">Length</Label>
                                  <Input className="h-8 text-xs" value={item.hdmi_tx_length || ''} onChange={e => updateSectionItem(si, ii, 'hdmi_tx_length', e.target.value)} placeholder="Length" />
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                      {(item.device_name === 'HDMI' || item.device_name === 'LAN') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Length</Label>
                            <Input className="h-8 text-xs" value={item.length || ''} onChange={e => updateSectionItem(si, ii, 'length', e.target.value)} placeholder="Length" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Quantity</Label>
                            <Input type="number" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateSectionItem(si, ii, 'quantity', e.target.value)} placeholder="Quantity" />
                          </div>
                        </div>
                      )}
                      {item.device_name === 'Network Switch' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Model</Label>
                            <Input className="h-8 text-xs" value={item.model || ''} onChange={e => updateSectionItem(si, ii, 'model', e.target.value)} placeholder="Model" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Number of Ports</Label>
                            <Input type="number" className="h-8 text-xs" value={item.num_ports || ''} onChange={e => updateSectionItem(si, ii, 'num_ports', e.target.value)} placeholder="Ports" />
                          </div>
                        </div>
                      )}
                      {item.device_name === 'Power Extension' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Number of Gang</Label>
                            <Input type="number" className="h-8 text-xs" value={item.num_gang || ''} onChange={e => updateSectionItem(si, ii, 'num_gang', e.target.value)} placeholder="Gang" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Quantity</Label>
                            <Input type="number" className="h-8 text-xs" value={item.quantity || ''} onChange={e => updateSectionItem(si, ii, 'quantity', e.target.value)} placeholder="Quantity" />
                          </div>
                        </div>
                      )}
                      {!['HDMI Extender', 'HDMI', 'LAN', 'Power Extension', 'Network Switch'].includes(item.device_name) && (
                        <div className="space-y-1">
                          <Label className="text-xs">Remarks</Label>
                          <Input className="h-8 text-xs" value={item.notes} onChange={e => updateSectionItem(si, ii, 'notes', e.target.value)} placeholder="Remarks" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Equipment Decommissioned — Section-based (decommissioning) */}
        {form.report_type === 'decommissioning' && (
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Equipment Decommissioned</h2>
              <Button type="button" size="sm" variant="outline" onClick={addDecommSection}>
                <Plus size={14} className="mr-1" /> Add Section
              </Button>
            </div>
            <DecommissionScopeBar
              sections={form.decommission_sections || []}
              links={form.decommission_links || []}
              equipment={equipmentRecords}
              decommissionScope={form.decommission_scope}
              fullSiteConfirmed={form.full_site_confirmed}
              isFullSite={isFullSite}
              onScopeChange={setDecommissionScope}
              onFullSiteConfirm={() => setShowFullSiteConfirm(true)}
            />
            <FullSiteConfirmDialog
              open={showFullSiteConfirm}
              onOpenChange={setShowFullSiteConfirm}
              siteName={form.site_name}
              activeEquipmentCount={getReliableEquipmentForContext({ equipment: equipmentRecords, clientId: form.client_id, siteId: form.site_id, inventoryId: '' }).length}
              onConfirm={confirmFullSite}
            />
            {(form.decommission_sections || []).map((sec, si) => (
              <div key={si} className="border border-primary/30 rounded-lg p-4 space-y-3 bg-muted/10">
                {/* Section header */}
                <div className="flex items-center gap-2">
                  
                  <div className="relative flex-1">
                    <div className="relative">
                      <Input
                        className="h-8 text-sm font-semibold pr-9"
                        value={decommissionLicenseSearch[si] ?? sec.section_name ?? ''}
                        onClick={() => {
                          setDecommissionLicenseOpen(prev => ({ ...prev, [si]: !prev[si] }));
                          setDecommissionLicenseSearch(prev => ({ ...prev, [si]: prev[si] ?? '' }));
                        }}
                        onChange={e => {
                          setDecommissionLicenseSearch(prev => ({ ...prev, [si]: e.target.value }));
                          setDecommissionLicenseOpen(prev => ({ ...prev, [si]: true }));
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setDecommissionLicenseSearch(prev => ({ ...prev, [si]: undefined }));
                            setDecommissionLicenseOpen(prev => ({ ...prev, [si]: false }));
                          }, 150);
                        }}
                        placeholder="Select license"
                      />

                      <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform ${decommissionLicenseOpen[si] ? 'rotate-180' : ''}`} />
                    </div>

                    {decommissionLicenseOpen[si] && (
                      <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                        {siteLicenses
                          .filter(inv => String(inv.license_name || '').toLowerCase().includes((decommissionLicenseSearch[si] || '').toLowerCase()))
                          .map(inv => (
                            <button
                              key={inv.id}
                              type="button"
                              onClick={() => {
                                selectDecommissionLicense(si, inv.id);
                                setDecommissionLicenseSearch(prev => ({ ...prev, [si]: undefined }));
                                setDecommissionLicenseOpen(prev => ({ ...prev, [si]: false }));
                              }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                            >
                              <span className="font-medium">{inv.license_name}</span>
                              {inv.license_number && <span className="text-muted-foreground font-mono ml-2">{inv.license_number}</span>}
                            </button>
                          ))}
                        {siteLicenses.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            {form.site_id ? 'No license found for this site' : 'Select a site to choose a license'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={() => removeDecommSection(si)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* Items within section */}
                <div className="space-y-3 pl-2 border-l-2 border-border">
                  {(sec.items || []).map((item, ii) => (
                    <div key={ii} className="border border-border rounded-lg p-3 space-y-2 relative bg-card">
                      <button type="button" onClick={() => removeDecommItemFromSection(si, ii)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                        <Trash2 size={12} />
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Device Type</Label>
                          <Select value={item.device_type || undefined} onValueChange={v => updateDecommSectionItem(si, ii, 'device_type', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                            <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Device Name / Model</Label>
                          <Input className="h-8 text-xs" list={`decomm-device-${si}-${ii}`} value={item.device_name} onChange={e => { updateDecommSectionItem(si, ii, 'device_name', e.target.value); ensureLink(si, ii); }} placeholder="Select or enter Name / Model" />
                          <datalist id={`decomm-device-${si}-${ii}`}>
                            {[...new Set(getDecommissionEquipment(sec).filter(eq => !item.device_type || eq.device_type === item.device_type).map(eq => eq.device_name).filter(Boolean))].map(name => <option key={name} value={name} />)}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Serial Number</Label>
                          <Input className="h-8 text-xs" list={`decomm-serial-${si}-${ii}`} value={item.serial_number} onChange={e => { updateDecommSectionItem(si, ii, 'serial_number', e.target.value); ensureLink(si, ii); }} placeholder="Select or enter S/N" />
                          <datalist id={`decomm-serial-${si}-${ii}`}>
                            {[...new Set(getDecommissionEquipment(sec).filter(eq => (!item.device_type || eq.device_type === item.device_type) && (!item.device_name || norm(eq.device_name) === norm(item.device_name))).map(eq => eq.serial_number).filter(Boolean))].map(serial => <option key={serial} value={serial} />)}
                          </datalist>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Reason for Decommission</Label>
                        <Input className="h-8 text-xs" value={item.reason_for_decommission} onChange={e => updateDecommSectionItem(si, ii, 'reason_for_decommission', e.target.value)} placeholder="Reason" />
                      </div>
                      <EquipmentPicker
                        sectionIndex={si}
                        itemIndex={ii}
                        item={item}
                        links={form.decommission_links || []}
                        equipment={equipmentRecords}
                        clientId={form.client_id}
                        siteId={form.site_id}
                        inventoryId={sec.inventory_id || ''}
                        onLinkEquipment={linkEquipment}
                        onConfirmUnmatched={confirmUnmatched}
                      />
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => addDecommItemToSection(si)}>
                    <Plus size={12} className="mr-1" /> Add Item
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pre-Job Site Assessment */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Pre-Job Site Assessment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'overall', label: '1. Overall' },
              { key: 'power', label: '2. Power' },
              { key: 'internet', label: '3. Internet' },
              { key: 'cables', label: '4. Cables' },
              { key: 'server_rack', label: '5. Server Rack / Shelves' },
              { key: 'others', label: '6. Others' },
            ].map(s => (
              <div key={s.key} className="space-y-1">
                <Label className="text-xs font-semibold">{s.label}</Label>
                {s.key === 'internet' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">1. SSID</Label>
                      <Input className="h-8 text-xs" value={(form.pre_job_assessment_sections || {}).internet_ssid || ''} onChange={e => setForm(f => ({ ...f, pre_job_assessment_sections: { ...(f.pre_job_assessment_sections || {}), internet_ssid: e.target.value } }))} placeholder="SSID" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">2. Password</Label>
                      <Input className="h-8 text-xs" value={(form.pre_job_assessment_sections || {}).internet_password || ''} onChange={e => setForm(f => ({ ...f, pre_job_assessment_sections: { ...(f.pre_job_assessment_sections || {}), internet_password: e.target.value } }))} placeholder="Password" />
                    </div>
                  </div>
                ) : (
                  <Textarea value={(form.pre_job_assessment_sections || {})[s.key] || ''} onChange={e => setForm(f => ({ ...f, pre_job_assessment_sections: { ...(f.pre_job_assessment_sections || {}), [s.key]: e.target.value } }))} placeholder={`Describe ${s.label.replace(/^\d+\.\s*/, '')}…`} rows={3} className="text-sm" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Post Job Technician Note */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Post Job Technician Note</h2>
          <Textarea value={form.technician_notes} onChange={e => set('technician_notes', e.target.value)} placeholder="Describe the work carried out, observations, or any issues encountered…" rows={4} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">1. Deliverables</Label>
              <Textarea value={form.technician_deliverables || ''} onChange={e => set('technician_deliverables', e.target.value)} placeholder="Deliverables" rows={3} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">2. Handover</Label>
              <Textarea value={form.technician_handover || ''} onChange={e => set('technician_handover', e.target.value)} placeholder="Handover" rows={3} className="text-sm" />
            </div>
          </div>
        </div>

        {/* Pre-Install Photos */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Pre-Install Photos</h2>
          <PhotoPairUploader label="Pre-Install" value={form.pre_job_assessment_photos} onChange={(v) => set('pre_job_assessment_photos', v)} max={12} />
        </div>

        {/* Post-Install Photos */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Post-Install Photos</h2>
          <PhotoPairUploader label="Post-Install" value={form.supporting_photos} onChange={(v) => set('supporting_photos', v)} max={12} />
        </div>

        {/* Supporting Documents */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Supporting Documents</h2>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 items-start">
              {(form.supporting_documents || []).map((url, i) => isImage(url) ? (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-24 h-24 object-cover rounded border border-border" />
                  <button type="button" onClick={() => set('supporting_documents', form.supporting_documents.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 hidden group-hover:flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              ) : null)}
              <label className="w-24 h-24 border border-dashed border-border rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors gap-1">
                <Upload size={16} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{uploading ? 'Uploading…' : 'Add Photos'}</span>
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={e => handleMultiPhotoUpload(e, 'supporting_documents')} />
              </label>
            </div>
            <div className="space-y-2">
              {(form.supporting_documents || []).map((url, i) => !isImage(url) ? (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <a href={url} target="_blank" rel="noreferrer" className="underline truncate max-w-xs">Document {i + 1}</a>
                  <button type="button" onClick={() => set('supporting_documents', form.supporting_documents.filter((_, j) => j !== i))} className="text-destructive"><X size={12} /></button>
                </div>
              ) : null)}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-primary hover:underline">
                <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload document'}
                <input type="file" className="hidden" disabled={uploading} onChange={handleDocUpload} />
              </label>
            </div>
          </div>
        </div>

        {/* Acknowledgement */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Acknowledgement</h2>
          <div className={rowClass}>
            <div className="space-y-1">
              <Label>Acknowledged By (Name)</Label>
              <Input value={form.ack_name} onChange={e => set('ack_name', e.target.value)} placeholder="Recipient name" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.ack_phone} onChange={e => set('ack_phone', e.target.value)} placeholder="Phone number" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Signature</Label>
              <SignaturePad
                value={form.ack_signature}
                onChange={handleSignatureChange}
              />
            </div>
            <div className="space-y-1">
              <Label>Company Stamp</Label>
              {form.ack_company_stamp ? (
                <div className="relative inline-block w-full">
                  <img src={form.ack_company_stamp} alt="Company Stamp" className="w-full max-h-40 object-contain rounded border border-border bg-muted/20" />
                  <button type="button" onClick={() => set('ack_company_stamp', '')} className="absolute top-1 right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X size={10} /></button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded cursor-pointer hover:border-primary transition-colors bg-muted/10">
                  {uploadingStamp ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><Upload size={16} className="text-muted-foreground mb-2" /><span className="text-xs text-muted-foreground">Upload Stamp</span></>}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingStamp} onChange={handleStampUpload} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Admin */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Notification</h2>
          <div className="space-y-1 max-w-sm">
            <Label>Admin Email</Label>
            <Input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@company.com" />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/installation')}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || uploading}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Report'}
          </Button>
        </div>
      </form>
    </div>
  );
}
// Inline Add dialogs: no separate Add*.jsx component files required.
const SLA_OPTIONS = ['subscribe', 'on-demand'];
const CMS_OPTIONS = ['CS Play', 'CS Sign Hub', 'CS Deals', 'CS Context', 'OmniBuy', 'DOTS'];
const HARDWARE_OPTIONS = ['PC', 'Cable', 'Controller', 'TV', 'LED', 'Network Device'];
const blankClient = () => ({ company_name: '', contact_person: '', pic_designation: '', contact_email: '', contact_phone: '', company_website: '', sla: '', cms_subscriptions: [], hardware: [], address: '', notes: '' });
function AddClientDialog({ open, onOpenChange, clients = [], onConfirm, busy }) {
  const [draft, setDraft] = useState(blankClient());
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(false);
  useEffect(() => { if (!open) { setDraft(blankClient()); setConflicts([]); setError(''); } }, [open]);
  const setField = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const toggleArray = (field, value) => setDraft(d => {
    const arr = d[field] || [];
    return { ...d, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
  });
  const handleConfirm = async () => {
    if (!draft.company_name.trim() || pendingRef.current || busy) return;
    pendingRef.current = true; setSaving(true); setError('');
    try {
      const matches = findSimilarClients(draft.company_name, clients);
      setConflicts(matches);
      await onConfirm({ ...draft, company_name: draft.company_name.trim() }, matches);
    } catch (err) { setError(err.message || 'Unable to save client.'); }
    finally { pendingRef.current = false; setSaving(false); }
  };
  const locked = busy || saving;
  const handleClose = (value) => {
    if (locked) return;
    if (!value) { setDraft(blankClient()); setConflicts([]); setError(''); }
    onOpenChange(value);
  };
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
        <fieldset disabled={locked} className="space-y-3 mt-2 border-0 p-0 m-0">
          <div className="space-y-1.5"><Label className="text-muted-foreground">Company Name <span className="text-red-400">*</span></Label><Input value={draft.company_name} onChange={e => setField('company_name', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Contact Person</Label><Input value={draft.contact_person} onChange={e => setField('contact_person', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">PIC Designation</Label><Input value={draft.pic_designation} onChange={e => setField('pic_designation', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Contact Email</Label><Input type="email" value={draft.contact_email} onChange={e => setField('contact_email', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Contact Phone</Label><Input value={draft.contact_phone} onChange={e => setField('contact_phone', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Company Website</Label><Input value={draft.company_website} onChange={e => setField('company_website', e.target.value)} className="bg-background" /></div>
          {conflicts.length > 0 && <p className="text-xs text-amber-500">A client with a similar name already exists.</p>}
          <div className="space-y-1.5"><Label className="text-muted-foreground">SLA</Label><Select value={draft.sla || undefined} onValueChange={v => setField('sla', v)}><SelectTrigger className="bg-background"><SelectValue placeholder="Select SLA type" /></SelectTrigger><SelectContent>{SLA_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">CMS Subscription</Label><div className="flex flex-wrap gap-1.5">{CMS_OPTIONS.map(o => <button key={o} type="button" aria-pressed={(draft.cms_subscriptions || []).includes(o)} onClick={() => toggleArray('cms_subscriptions', o)} className={`px-2 py-0.5 rounded-md text-sm border transition-colors ${(draft.cms_subscriptions || []).includes(o) ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground hover:border-primary/40'}`}>{o}</button>)}</div></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Hardware</Label><div className="flex flex-wrap gap-1.5">{HARDWARE_OPTIONS.map(o => <button key={o} type="button" aria-pressed={(draft.hardware || []).includes(o)} onClick={() => toggleArray('hardware', o)} className={`px-2 py-0.5 rounded-md text-sm border transition-colors ${(draft.hardware || []).includes(o) ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground hover:border-primary/40'}`}>{o}</button>)}</div></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Address</Label><Textarea value={draft.address} onChange={e => setField('address', e.target.value)} className="bg-background resize-none" rows={2} /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Notes</Label><Textarea value={draft.notes} onChange={e => setField('notes', e.target.value)} className="bg-background resize-none" rows={2} /></div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="mt-4"><Button type="button" variant="outline" disabled={locked} onClick={() => handleClose(false)}>Cancel</Button><Button type="button" onClick={handleConfirm} disabled={locked || !draft.company_name.trim()}>{locked ? 'Saving...' : 'Add Client'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
const MY_STATES = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'];
const REGIONS = ['Central', 'Northern', 'Southern', 'East Coast', 'East Malaysia'];
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
  { value: 're-instating', label: 'Re-Instating' }, { value: 're-instated', label: 'Re-Instated' },
];
function AddSiteDialog({ open, onOpenChange, clients = [], sites = [], isAdmin = false, linkedClientId = '', onConfirm, busy }) {
  const build = () => ({ client_id: linkedClientId || '', site_name: '', site_location: '', region: '', state: '', pic_name: '', pic_phone: '', notes: '', status: [] });
  const [draft, setDraft] = useState(build);
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(false);
  useEffect(() => { if (open) { setDraft(d => ({ ...build(), client_id: linkedClientId || d.client_id })); setConflicts([]); setError(''); } }, [open, linkedClientId]);
  const setField = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const selectedClientName = clients.find(c => c.id === draft.client_id)?.company_name || '';
  const handleConfirm = async () => {
    if (!draft.client_id || !draft.site_name.trim() || pendingRef.current || busy) return;
    pendingRef.current = true; setSaving(true); setError('');
    try {
      const matches = findSimilarSites(draft.site_name, draft.client_id, sites);
      setConflicts(matches);
      await onConfirm({ ...draft, site_name: draft.site_name.trim(), client_name: selectedClientName }, matches);
    } catch (err) { setError(err.message || 'Unable to save site.'); }
    finally { pendingRef.current = false; setSaving(false); }
  };
  const locked = busy || saving;
  const handleClose = (value) => {
    if (locked) return;
    if (!value) { setDraft(build()); setConflicts([]); setError(''); }
    onOpenChange(value);
  };
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add New Site</DialogTitle></DialogHeader>
        <fieldset disabled={locked} className="space-y-3 mt-2 border-0 p-0 m-0">
          <div className="space-y-1.5"><Label className="text-muted-foreground">Client <span className="text-red-400">*</span></Label><Select value={draft.client_id || undefined} onValueChange={v => setField('client_id', v)}><SelectTrigger className="bg-background"><SelectValue placeholder="Select client" /></SelectTrigger><SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-muted-foreground">State</Label><Select value={draft.state || undefined} onValueChange={v => setField('state', v)}><SelectTrigger className="bg-background"><SelectValue placeholder="Select state..." /></SelectTrigger><SelectContent className="max-h-60">{MY_STATES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-muted-foreground">Region</Label><Select value={draft.region || undefined} onValueChange={v => setField('region', v)}><SelectTrigger className="bg-background"><SelectValue placeholder="Select region..." /></SelectTrigger><SelectContent>{REGIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Site Status</Label><Select value={draft.status?.[0] || undefined} onValueChange={v => setField('status', [v])}><SelectTrigger className="bg-background"><SelectValue placeholder="Select status..." /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Site Name <span className="text-red-400">*</span></Label><Input value={draft.site_name} onChange={e => setField('site_name', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">Site Location</Label><Input value={draft.site_location} onChange={e => setField('site_location', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">PIC Name</Label><Input value={draft.pic_name} onChange={e => setField('pic_name', e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label className="text-muted-foreground">PIC Phone</Label><Input value={draft.pic_phone} onChange={e => setField('pic_phone', e.target.value)} className="bg-background" /></div>
          {conflicts.length > 0 && <p className="text-xs text-amber-500">A site with a similar name already exists under this client.</p>}
          <div className="space-y-1.5"><Label className="text-muted-foreground">Notes</Label><Textarea value={draft.notes} onChange={e => setField('notes', e.target.value)} className="bg-background resize-none" rows={2} /></div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="mt-4"><Button type="button" variant="outline" disabled={locked} onClick={() => handleClose(false)}>Cancel</Button><Button type="button" onClick={handleConfirm} disabled={locked || !draft.client_id || !draft.site_name.trim()}>{locked ? 'Saving...' : 'Add Site'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function AddLicenseDialog({ open, onOpenChange, inventoryItems = [], stagedLicenses = [], linkedClientId = '', linkedClientName = '', linkedSiteId = '', linkedSiteName = '', outlet = '', onConfirm, busy }) {
  const build = () => ({ license_name: '', license_number: '', pc_sku: '', tv_sku: '', processor: '', anydesk: '', outlet: outlet || '', client_id: linkedClientId || '', client_name: linkedClientName || '', site_id: linkedSiteId || '', site_name: linkedSiteName || '' });
  const [draft, setDraft] = useState(build);
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(false);
  useEffect(() => { if (open) { setDraft(build()); setConflict(null); setError(''); } }, [open, linkedClientId, linkedClientName, linkedSiteId, linkedSiteName, outlet]);
  const setField = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const checkAndConfirm = async () => {
    if (!draft.license_number.trim() || pendingRef.current || busy) return;
    const found = findLicenseNumberConflict(draft.license_number, { inventoryItems, stagedLicenses });
    setConflict(found);
    if (found) return;
    pendingRef.current = true; setSaving(true); setError('');
    try { await onConfirm({ ...draft, license_number: draft.license_number.trim() }); }
    catch (err) { setError(err.message || 'Unable to save license.'); }
    finally { pendingRef.current = false; setSaving(false); }
  };
  const locked = busy || saving;
  const handleClose = value => {
    if (locked) return;
    if (!value) { setDraft(build()); setConflict(null); setError(''); }
    onOpenChange(value);
  };
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]" onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); checkAndConfirm(); } }}>
        <DialogHeader><DialogTitle>Add New License</DialogTitle></DialogHeader>
        <fieldset disabled={locked} className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1 border-0 m-0">
          <div className="space-y-1 sm:col-span-2"><Label>License Name</Label><Input value={draft.license_name} onChange={e => setField('license_name', e.target.value)} placeholder="License / system name" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>License Number *</Label><Input value={draft.license_number} onChange={e => { setField('license_number', e.target.value); setConflict(null); }} placeholder="Globally unique license number" />
            {conflict && <p className="text-xs text-destructive">{conflict.kind === 'inventory' ? 'An existing inventory license' : 'A staged license'} already uses this number: {conflict.record.license_name || conflict.record.company_name}. Resolve the conflict before saving.</p>}
          </div>
          <div className="space-y-1"><Label>PC SKU</Label><Input value={draft.pc_sku} onChange={e => setField('pc_sku', e.target.value)} placeholder="PC SKU" /></div>
          <div className="space-y-1"><Label>TV SKU</Label><Input value={draft.tv_sku} onChange={e => setField('tv_sku', e.target.value)} placeholder="TV SKU" /></div>
          <div className="space-y-1"><Label>Processor</Label><Input value={draft.processor} onChange={e => setField('processor', e.target.value)} placeholder="Processor / model" /></div>
          <div className="space-y-1"><Label>AnyDesk</Label><Input value={draft.anydesk} onChange={e => setField('anydesk', e.target.value)} placeholder="AnyDesk ID" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Outlet</Label><Input value={draft.outlet} onChange={e => setField('outlet', e.target.value)} placeholder="Outlet (distinct from site name)" /></div>
          <div className="space-y-1 sm:col-span-2 text-xs text-muted-foreground border-t border-border pt-2">Linked to {draft.client_name || '—'} · {draft.site_name || '—'}</div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={locked} onClick={() => handleClose(false)}>Cancel</Button><Button type="button" onClick={checkAndConfirm} disabled={locked || !draft.license_number.trim() || !!conflict}>{locked ? 'Saving...' : 'Add License'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
