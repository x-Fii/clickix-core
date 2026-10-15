import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Save, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
const DEVICE_TYPES = ['PC', 'TV', 'Network Device', 'Cabling', 'CMS Software', 'Other'];
const AFFECTED_DEVICE_TYPES = [
  'CMS', 'PC', 'TV', 'HDMI Extender', 'Cable', 'Others'
];
const AFFECTED_INVENTORY_FIELDS = {
  'CMS': 'license_number',
  'PC': 'pc_sku',
  'TV': 'tv_sku'
};
const PILLARS = ['PC', 'TV', 'CMS', 'Display Connection', 'Network', 'Content', 'User'];
const emptyItem = () => ({ device_type: '', device_name: '', issue_description: '' });
const SectionHeader = ({ title, subtitle }) => (
  <div className="pb-3 mb-5 border-b border-border">
    <h3 className="font-semibold text-sm">{title}</h3>
    {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
  </div>
);
const Field = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
      {label}{required && <span className="text-red-400 ml-1">*</span>}
    </Label>
    {children}
  </div>
);
const ReadField = ({ label, value }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mb-1">{label}</p>
    <p className="text-sm">{value || <span className="text-muted-foreground/50">—</span>}</p>
  </div>
);
export default function L1DraftEditor({ report }) {
  const queryClient = useQueryClient();
  const { data: inventoryItems = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => base44.entities.Inventory.list()});
  const licenseNameOptions = [...new Set(inventoryItems.map((item) => String(item.license_name || '').trim()).filter(Boolean))].sort();
  const [form, setForm] = useState({
    reported_by: report.reported_by || '',
    do_number: report.do_number || '',
    whatsapp_response_id: report.whatsapp_response_id || '',
    l1_date: report.l1_date || '',
    l1_attended_staff_name: report.l1_attended_staff_name || '',
    l1_attended_staff_id: report.l1_attended_staff_id || '',
    l1_attended_staff_email: report.l1_attended_staff_email || '',
    l1_issue_statement: report.l1_issue_statement || '',
    l1_issue_pillar: Array.isArray(report.l1_issue_pillar) ? report.l1_issue_pillar : [],
    l1_rectification_done: report.l1_rectification_done || '',
    l1_remarks: report.l1_remarks || '',
  });
  const [sections, setSections] = useState(() => {
    if (report.l1_affected_sections?.length) return report.l1_affected_sections;
    if (report.l1_affected_items?.length) return [{ section_name: '', items: report.l1_affected_items }];
    return [{ section_name: '', items: [emptyItem()] }];
  });
  const [staffList, setStaffList] = useState([]);
  useEffect(() => {
    base44.entities.StaffMember.list().then(setStaffList).catch(() => {});
  }, []);
  const l1Staff = staffList.filter((s) => s.role === 'L1' || s.role === 'Admin');
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleStaffChange = (id) => {
    const s = staffList.find((x) => x.id === id);
    if (s) setForm((f) => ({ ...f, l1_attended_staff_name: s.name, l1_attended_staff_id: s.staff_id, l1_attended_staff_email: s.email || '' }));
  };
  const addSection = () => setSections((p) => [...p, { section_name: '', items: [emptyItem()] }]);
  const removeSection = (si) => setSections((p) => p.filter((_, i) => i !== si));
  const updateSectionName = (si, val) => {
    setSections(prev =>
      prev.map((section, index) => {
        if (index !== si) return section;
        if (section.section_name === val) return section;
        return {
          ...section,
          section_name: val,
          items: (section.items || []).map(item => ({
            ...item,
            device_name: AFFECTED_INVENTORY_FIELDS[item.device_type]
              ? ''
              : item.device_name
          }))
        };
      })
    );
  };
  const addItemToSection = (si) => setSections((p) => p.map((s, i) => (i === si ? { ...s, items: [...s.items, emptyItem()] } : s)));
  const removeItemFromSection = (si, ii) => setSections((p) => p.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)));
  const updateSectionItem = (si, ii, field, v) => setSections((p) => p.map((s, i) => (i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, [field]: v } : it)) } : s)));
  const selectAffectedDeviceSlot = (sectionIndex, itemIndex, slotId) => {
    setSections(prev =>
      prev.map((section, si) => {
        if (si !== sectionIndex) return section;
        return {
          ...section,
          items: section.items.map((item, ii) => {
            if (ii !== itemIndex) return item;
            const slots = getAffectedDeviceSlots(
              section.section_name,
              item.device_type
            );
            const selectedSlot = slots.find(
              slot => slot.id === slotId
            );
            return {
              ...item,
              device_slot_id: selectedSlot?.id || '',
              device_name: selectedSlot?.name || ''
            };
          })
        };
      })
    );
  };
  const toggleAffectedDevice = (sectionIndex, deviceType, checked) => {
    setSections(prev =>
      prev.map((section, index) => {
        if (index !== sectionIndex) return section;
        const items = section.items || [];
        if (checked) {
          if (items.some(item => item.device_type === deviceType)) {
            return section;
          }
          const slots = getAffectedDeviceSlots(
            section.section_name,
            deviceType
          );
          // A missing Inventory value shows a read-only No Record row.
          // Never treat this placeholder as an actual device on save.
          const noRecord = !!AFFECTED_INVENTORY_FIELDS[deviceType] && slots.length === 0;
          // Automatically select when only one device exists
          const autoSlot = slots.length === 1 ? slots[0] : null;
          return {
            ...section,
            items: [
              ...items,
              {
                device_type: deviceType,
                __no_record_placeholder: noRecord,
                device_name: autoSlot?.name || '',
                device_slot_id: autoSlot?.id || '',
                issue_description: ''
              }
            ]
          };
        }
        // Uncheck: remove all items of this device type
        return {
          ...section,
          items: items.filter(
            item => item.device_type !== deviceType
          )
        };
      })
    );
  };
  // Add another item under a specific Device Type
  const addAffectedDeviceItem = (sectionIndex, deviceType) => {
    setSections(prev =>
      prev.map((section, index) => {
        if (index !== sectionIndex) return section;
        const slots = getAffectedDeviceSlots(
          section.section_name,
          deviceType
        );
        const usedIds = new Set(
          (section.items || [])
            .filter(item => item.device_type === deviceType)
            .map(item => item.device_slot_id)
            .filter(Boolean)
        );
        const availableSlots = slots.filter(
          slot => !usedIds.has(slot.id)
        );
        // Do not exceed the available Inventory quantity
        if (AFFECTED_INVENTORY_FIELDS[deviceType] &&
            (slots.length === 0 || (section.items || []).filter(item => item.device_type === deviceType).length >= slots.length)) {
          return section;
        }
        // Automatically select the last remaining device
        const autoSlot =
          availableSlots.length === 1
            ? availableSlots[0]
            : null;
        return {
          ...section,
          items: [
            ...(section.items || []),
            {
              device_type: deviceType,
              device_name: autoSlot?.name || '',
              device_slot_id: autoSlot?.id || '',
              issue_description: ''
            }
          ]
        };
      })
    );
  };
  // Get matching Device Names from Inventory
  const getAffectedDeviceOptions = (sectionName, deviceType) => {
    const inventoryField = AFFECTED_INVENTORY_FIELDS[deviceType];
    if (!inventoryField || !sectionName) return [];
    const matchingInventory = inventoryItems.filter(inv => {
      const sameLicense =
        String(inv.license_name || '').trim() ===
        String(sectionName || '').trim();
      const sameClient =
        !report.client_id ||
        !inv.client_id ||
        String(inv.client_id) === String(report.client_id);
      const sameSite =
        !report.site_id ||
        !inv.site_id ||
        String(inv.site_id) === String(report.site_id);
      return sameLicense && sameClient && sameSite;
    });
    return [...new Set(
      matchingInventory
        .flatMap(inv =>
        String(inv[inventoryField] || '')
          .split(',')
          .map(value => value.trim())
      )
        .filter(Boolean)
    )].sort();
  };
  // Each Inventory device is an individual selectable slot.
  // Duplicate SKU values are kept as separate devices.
  const getAffectedDeviceSlots = (sectionName, deviceType) => {
    const inventoryField = AFFECTED_INVENTORY_FIELDS[deviceType];
    if (!inventoryField || !sectionName) return [];
    const slots = [];
    inventoryItems.forEach((inv, inventoryIndex) => {
      const sameLicense =
        String(inv.license_name || '').trim() ===
        String(sectionName || '').trim();
      const sameClient =
        !report.client_id ||
        !inv.client_id ||
        String(inv.client_id) === String(report.client_id);
      const sameSite =
        !report.site_id ||
        !inv.site_id ||
        String(inv.site_id) === String(report.site_id);
      if (!sameLicense || !sameClient || !sameSite) return;
      const values = String(inv[inventoryField] || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
      values.forEach((name, valueIndex) => {
        slots.push({
          id: `${inv.id ?? inventoryIndex}-${inventoryField}-${valueIndex}`,
          name
        });
      });
    });
    // Give identical names separate display labels.
    const counts = {};
    slots.forEach(slot => {
      counts[slot.name] = (counts[slot.name] || 0) + 1;
    });
    const seen = {};
    return slots.map(slot => {
      seen[slot.name] = (seen[slot.name] || 0) + 1;
      return {
        ...slot,
        label: counts[slot.name] > 1
          ? `${slot.name} (${seen[slot.name]})`
          : slot.name
      };
    });
  };
  // Prepare affected devices before saving
  const prepareAffectedSections = () => {
    return sections.map(section => ({
      ...section,
      items: (section.items || [])
        .filter(item => item.device_type && !item.__no_record_placeholder)
        .map(item => {
          const slots = getAffectedDeviceSlots(
            section.section_name,
            item.device_type
          );
          const selectedSlot = slots.find(
            slot => slot.id === item.device_slot_id
          );
          // Preserve the selected device and unique slot ID
          if (selectedSlot) {
            return {
              ...item,
              device_name: selectedSlot.name,
              device_slot_id: selectedSlot.id
            };
          }
          // Auto-fill when Inventory contains exactly one device
          if (
            slots.length === 1 &&
            !item.device_slot_id &&
            !item.device_name
          ) {
            return {
              ...item,
              device_name: slots[0].name,
              device_slot_id: slots[0].id
            };
          }
          // Preserve manually entered values
          return item;
        })
    }));
  };
  const buildPayload = (l1Status, submit) => {
    const preparedSections = prepareAffectedSections();
    const allItems = preparedSections.flatMap(s => s.items);
    const status = l1Status === 'resolved' ? 'resolved' : l1Status === 'escalate' ? 'escalated' : 'reported';
    return {
      ...form,
      l1_status: l1Status,
      status,
      l1_affected_sections: preparedSections,
      l1_affected_items: allItems.filter((i) => i.device_type),
      l1_submitted: submit,
      ...(submit ? { l1_submitted_at: new Date().toISOString() } : {}),
    };
  };
  const saveMutation = useMutation({
    mutationFn: ({ l1Status, submit }) => base44.entities.ServiceReport.update(report.id, buildPayload(l1Status, submit)),
    onSuccess: (_data, { l1Status, submit }) => {
      queryClient.invalidateQueries({ queryKey: ['service-report', report.id] });
      queryClient.invalidateQueries({ queryKey: ['service-reports'] });
      if (submit) {
        if (l1Status === 'resolved') toast.success('Report submitted — marking as resolved');
        else if (l1Status === 'escalate') toast.success('Report submitted — escalating to L2');
        else toast.success('Report submitted — marking as pending');
      } else {
        toast.success('Draft saved');
      }
    },
    onError: (err) => toast.error(err?.message || 'Failed to save report'),
  });
  const busy = saveMutation.isPending;
  const handleSubmit = (l1Status) => saveMutation.mutate({ l1Status, submit: true });
  return (
    <div className="bg-card border border-amber-500/30 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="text-xs text-amber-400 font-mono">DRAFT</span> L1 Remote Support
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">This report is a draft. Edit and submit when ready.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => saveMutation.mutate({ l1Status: 'pending', submit: false })} disabled={busy} className="gap-2">
          <Save size={14} /> {busy ? 'Saving...' : 'Save Draft'}
        </Button>
      </div>
      {/* Job context (read-only) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4 border-b border-border">
        <ReadField label="Client" value={report.client_name} />
        <ReadField label="Site Name" value={report.site_name} />
        <ReadField label="Location" value={report.site_location} />
        <ReadField label="L1 Report Number" value={report.running_number} />
      </div>
      {/* L1 fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Reported By">
          <Input value={form.reported_by} onChange={(e) => setF('reported_by', e.target.value)} className="bg-background" placeholder="Name of reporter" />
        </Field>
        <Field label="DO Number">
          <Input value={form.do_number} onChange={(e) => setF('do_number', e.target.value)} className="bg-background" placeholder="DO-XXXX" />
        </Field>
        <Field label="Whatsapp Response ID">
          <Input value={form.whatsapp_response_id} onChange={(e) => setF('whatsapp_response_id', e.target.value)} className="bg-background font-mono" placeholder="Whatsapp Response ID" />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.l1_date} onChange={(e) => setF('l1_date', e.target.value)} className="bg-background" />
        </Field>
        <Field label="Attended By (Staff)">
          <Select value={l1Staff.find((s) => s.name === form.l1_attended_staff_name)?.id || undefined} onValueChange={handleStaffChange}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Select L1 staff" /></SelectTrigger>
            <SelectContent>
              {l1Staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.staff_id})</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Staff Email">
          <Input value={form.l1_attended_staff_email} onChange={(e) => setF('l1_attended_staff_email', e.target.value)} placeholder="staff@clickix.com" className="bg-background" />
        </Field>
      </div>
      <div className="space-y-4">
        <Field label="Issue Statement">
          <Textarea value={form.l1_issue_statement} onChange={(e) => setF('l1_issue_statement', e.target.value)} placeholder="Describe the issue reported..." className="bg-background resize-none" rows={3} />
        </Field>
        <Field label="Issue Pillar">
          <div className="flex flex-wrap gap-x-5 gap-y-2 bg-background border border-input rounded-md p-3">
            {PILLARS.map((opt) => {
              const arr = Array.isArray(form.l1_issue_pillar) ? form.l1_issue_pillar : [];
              const checked = arr.includes(opt);
              return (
                <div key={opt} className="flex items-center gap-2">
                  <Checkbox id={`draft-pillar-${opt}`} checked={checked} onCheckedChange={(v) => {
                    const cur = Array.isArray(form.l1_issue_pillar) ? [...form.l1_issue_pillar] : [];
                    const fixed = cur.filter((p) => PILLARS.includes(p));
                    const others = cur.filter((p) => !PILLARS.includes(p));
                    setF('l1_issue_pillar', v ? [...fixed, opt, ...others] : fixed.filter((p) => p !== opt).concat(others));
                  }} />
                  <label htmlFor={`draft-pillar-${opt}`} className="text-sm cursor-pointer">{opt}</label>
                </div>
              );
            })}
            <div className="flex items-center gap-2">
              <Checkbox id="draft-pillar-other" checked={(Array.isArray(form.l1_issue_pillar) ? form.l1_issue_pillar : []).some((p) => !PILLARS.includes(p))} onCheckedChange={(v) => {
                const cur = Array.isArray(form.l1_issue_pillar) ? [...form.l1_issue_pillar] : [];
                const fixed = cur.filter((p) => PILLARS.includes(p));
                setF('l1_issue_pillar', v ? [...fixed, ''] : fixed);
              }} />
              <label htmlFor="draft-pillar-other" className="text-sm cursor-pointer">Other</label>
            </div>
            {(Array.isArray(form.l1_issue_pillar) ? form.l1_issue_pillar : []).some((p) => !PILLARS.includes(p)) && (
              <Input
                value={(Array.isArray(form.l1_issue_pillar) ? form.l1_issue_pillar : []).find((p) => !PILLARS.includes(p)) || ''}
                onChange={(e) => {
                  const cur = Array.isArray(form.l1_issue_pillar) ? [...form.l1_issue_pillar] : [];
                  const fixed = cur.filter((p) => PILLARS.includes(p));
                  setF('l1_issue_pillar', e.target.value ? [...fixed, e.target.value] : fixed);
                }}
                className="bg-background h-8 flex-1 min-w-[160px]"
                placeholder="Specify other pillar..."
              />
            )}
          </div>
        </Field>
        <Field label="Rectification Done">
          <Textarea value={form.l1_rectification_done} onChange={(e) => setF('l1_rectification_done', e.target.value)} placeholder="Describe the rectification actions taken..." className="bg-background resize-none" rows={3} />
        </Field>
        <Field label="Remarks / Notes">
          <Textarea value={form.l1_remarks} onChange={(e) => setF('l1_remarks', e.target.value)} placeholder="Any additional remarks or notes for this L1 session..." className="bg-background resize-none" rows={3} />
        </Field>
      </div>
      {/* Affected items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Affected Hardware / Software</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSection} className="gap-1 text-xs">
            <Plus size={12} /> Add Section
          </Button>
        </div>
        <div className="space-y-3">
          {sections.map((sec, si) => (
            <div key={si} className="border border-primary/30 rounded-lg p-2.5 space-y-2 bg-muted/10">
              <div className="flex items-center gap-2">
                <Input
                  list={`sr-license-options-${si}`}
                  value={sec.section_name || ''}
                  onChange={(e) => updateSectionName(si, e.target.value)}
                  placeholder="Select or type license name"
                  className="bg-background text-xs h-8 font-semibold flex-1"
                />
                <datalist id={`sr-license-options-${si}`}>
                  {licenseNameOptions.map(name => <option key={name} value={name} />)}
                </datalist>
                {sections.length > 1 && (
                  <button type="button" onClick={() => removeSection(si)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
              {/* Items within section */}
              <div className="space-y-2 pl-2 border-l-2 border-border">
                {/* Affected Device Checkboxes */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Label className="text-xs text-muted-foreground shrink-0">
                    Affected Devices
                  </Label>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {AFFECTED_DEVICE_TYPES.map(type => {
                      const checked = (sec.items || []).some(
                        item => item.device_type === type
                      );
                      return (
                        <div key={type} className="flex items-center gap-1.5">
                          <Checkbox
                            id={`draft-affected-${si}-${type}`}
                            checked={checked}
                            onCheckedChange={value =>
                              toggleAffectedDevice(si, type, value === true)
                            }
                          />
                          <label
                            htmlFor={`draft-affected-${si}-${type}`}
                            className="text-xs cursor-pointer"
                          >
                            {type}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Each selected Device Type */}
                {AFFECTED_DEVICE_TYPES.filter(type =>
                  (sec.items || []).some(item => item.device_type === type)
                ).map(type => {
                  const deviceItems = (sec.items || [])
                    .map((item, index) => ({
                      item,
                      actualIndex: index
                    }))
                    .filter(entry => entry.item.device_type === type);
                  const deviceOptions = getAffectedDeviceOptions(
                    sec.section_name,
                    type
                  );
                  const inventoryField = AFFECTED_INVENTORY_FIELDS[type];
                  return (
                    <div
                      key={type}
                      className="border border-border rounded-md p-2.5 space-y-2 bg-muted/10"
                    >
                      {/* Device Type Header */}
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">
                          {type}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-7 px-2.5"
                          disabled={!!inventoryField && (getAffectedDeviceSlots(sec.section_name, type).length === 0 || deviceItems.length >= getAffectedDeviceSlots(sec.section_name, type).length)}
                          onClick={() => addAffectedDeviceItem(si, type)}
                        >
                          <Plus size={12} />
                          Add Item
                        </Button>
                      </div>
                      {/* Device Items */}
                      {deviceItems.map(({ item, actualIndex }, itemIndex) => (
                        <div
                          key={`${type}-${actualIndex}`}
                          className="border border-border rounded-md p-2.5 space-y-2 bg-card"
                        >
                          {/* Item Number and Remove */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Item {itemIndex + 1}
                            </span>
                            {deviceItems.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive h-7 px-2"
                                onClick={() =>
                                  removeItemFromSection(si, actualIndex)
                                }
                              >
                                <X size={14} />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Device Type */}
                            <Field label="Device Type">
                              <Input
                                value={type}
                                readOnly
                                className="bg-muted text-xs h-8"
                              />
                            </Field>
                            {/* Device Name */}
                            <Field label="Device Name">
                              {(() => {
                                const slots = getAffectedDeviceSlots(
                                  sec.section_name,
                                  type
                                );
                                const usedSlotIds = new Set(
                                  (sec.items || [])
                                    .filter((other, index) =>
                                      index !== actualIndex &&
                                      other.device_type === type &&
                                      other.device_slot_id
                                    )
                                    .map(other => other.device_slot_id)
                                );
                                const availableSlots = slots.filter(
                                  slot => !usedSlotIds.has(slot.id)
                                );
                                const selectedSlot = slots.find(
                                  slot => slot.id === item.device_slot_id
                                );
                                if (inventoryField && slots.length === 0) {
                                  return <Input value={item.__no_record_placeholder ? 'No Record' : (item.device_name || 'No Record')} readOnly className="bg-muted text-xs h-8 cursor-not-allowed" />;
                                }
                                if (!inventoryField) {
                                  return (
                                    <Input
                                      value={item.device_name || ''}
                                      onChange={e =>
                                        updateSectionItem(
                                          si,
                                          actualIndex,
                                          'device_name',
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        "Enter Device Name"
                                      }
                                      className="bg-background text-xs h-8"
                                    />
                                  );
                                }
                                if (item.device_name && !selectedSlot) {
                                  return (
                                    <Input
                                      value={item.device_name}
                                      readOnly
                                      className="bg-muted text-xs h-8"
                                    />
                                  );
                                }
                                if (selectedSlot && availableSlots.length === 1) {
                                  return (
                                    <Input
                                      value={selectedSlot.label}
                                      readOnly
                                      className="bg-muted text-xs h-8"
                                    />
                                  );
                                }
                                return (
                                  <Select
                                    value={
                                      availableSlots.some(
                                        slot => slot.id === item.device_slot_id
                                      )
                                        ? item.device_slot_id
                                        : undefined
                                    }
                                    onValueChange={value =>
                                      selectAffectedDeviceSlot(
                                        si,
                                        actualIndex,
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger className="bg-background text-xs h-8">
                                      <SelectValue placeholder="Select Device Name" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableSlots.map(slot => (
                                        <SelectItem key={slot.id} value={slot.id}>
                                          {slot.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                            </Field>
                          </div>
                          {/* Issue Description */}
                          <Field label="Issue Description">
                            <Textarea
                              value={item.issue_description || ''}
                              onChange={e =>
                                updateSectionItem(
                                  si,
                                  actualIndex,
                                  'issue_description',
                                  e.target.value
                                )
                              }
                              placeholder="Describe the issue in detail..."
                              rows={4}
                              className="bg-background resize-y"
                            />
                          </Field>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Resolution actions */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">L1 Resolution — Submit</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => handleSubmit('resolved')}
            disabled={busy}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors text-left disabled:opacity-50"
          >
            <CheckCircle size={24} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-400 text-sm">Resolved</p>
              <p className="text-xs text-muted-foreground mt-0.5">Issue resolved remotely. Submit report.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('escalate')}
            disabled={busy}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-colors text-left disabled:opacity-50"
          >
            <AlertTriangle size={24} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-400 text-sm">Escalate to L2</p>
              <p className="text-xs text-muted-foreground mt-0.5">Requires onsite support. Escalate to L2 team.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('pending')}
            disabled={busy}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15 transition-colors text-left disabled:opacity-50"
          >
            <Clock size={24} className="text-sky-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sky-400 text-sm">Pending</p>
              <p className="text-xs text-muted-foreground mt-0.5">Awaiting further info or action.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
