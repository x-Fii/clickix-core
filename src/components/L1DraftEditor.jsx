import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  const updateSectionName = (si, v) => setSections((p) => p.map((s, i) => (i === si ? { ...s, section_name: v } : s)));
  const addItemToSection = (si) => setSections((p) => p.map((s, i) => (i === si ? { ...s, items: [...s.items, emptyItem()] } : s)));
  const removeItemFromSection = (si, ii) => setSections((p) => p.map((s, i) => (i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s)));
  const updateSectionItem = (si, ii, field, v) => setSections((p) => p.map((s, i) => (i === si ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, [field]: v } : it)) } : s)));

  const buildPayload = (l1Status, submit) => {
    const allItems = sections.flatMap((s) => s.items);
    const status = l1Status === 'resolved' ? 'resolved' : l1Status === 'escalate' ? 'escalated' : 'reported';
    return {
      ...form,
      l1_status: l1Status,
      status,
      l1_affected_sections: sections,
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
            <div key={si} className="border border-primary/30 rounded-lg p-3 space-y-2 bg-muted/10">
              <div className="flex items-center gap-2">
                <Input
                  value={sec.section_name}
                  onChange={(e) => updateSectionName(si, e.target.value)}
                  placeholder="Section name (e.g. Level 1, Lobby)"
                  className="bg-background text-xs h-8 font-semibold flex-1"
                />
                {sections.length > 1 && (
                  <button type="button" onClick={() => removeSection(si)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="space-y-2 pl-2 border-l-2 border-border">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="flex gap-2 items-start p-2 bg-card rounded border border-border">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Select value={item.device_type || undefined} onValueChange={(v) => updateSectionItem(si, ii, 'device_type', v)}>
                        <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Device Type" /></SelectTrigger>
                        <SelectContent>{DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input value={item.device_name} onChange={(e) => updateSectionItem(si, ii, 'device_name', e.target.value)} placeholder="Device name / ID" className="bg-background text-xs h-8" />
                      <Input value={item.issue_description} onChange={(e) => updateSectionItem(si, ii, 'issue_description', e.target.value)} placeholder="Issue description" className="bg-background text-xs h-8" />
                    </div>
                    {sec.items.length > 1 && (
                      <button type="button" onClick={() => removeItemFromSection(si, ii)} className="text-muted-foreground hover:text-destructive mt-1 shrink-0">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => addItemToSection(si)} className="text-xs gap-1 h-7">
                  <Plus size={11} /> Add Item
                </Button>
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