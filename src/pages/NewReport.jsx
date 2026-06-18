import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const DEVICE_TYPES = ['PC', 'TV', 'Network Device', 'Cabling', 'CMS Software', 'Other'];
const emptyItem = () => ({ device_type: '', device_name: '', issue_description: '' });

const generateRunningNumber = () => {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `SR${y}-${seq}`;
};

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

export default function NewReport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    running_number: generateRunningNumber(),
    l1_date: new Date().toISOString().split('T')[0],
    reported_by: '',
    client_id: '', client_name: '',
    site_id: '', site_name: '', site_location: '',
    l1_attended_staff_name: '', l1_attended_staff_id: '', l1_attended_staff_email: '',
    do_number: '',
    l1_remarks: '',
  });
  const [affectedItems, setAffectedItems] = useState([emptyItem()]);

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: staffList = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.StaffMember.list() });

  const [siteRegionFilter, setSiteRegionFilter] = useState('');
  const [siteStateFilter, setSiteStateFilter] = useState('');

  const regionOptions = [...new Set(sites.map(s => s.region).filter(Boolean))].sort();
  const stateOptions = [...new Set(sites.filter(s => !siteRegionFilter || s.region === siteRegionFilter).map(s => s.state).filter(Boolean))].sort();

  const filteredSites = sites.filter(s =>
    (!form.client_id || s.client_id === form.client_id) &&
    (!siteRegionFilter || s.region === siteRegionFilter) &&
    (!siteStateFilter || s.state === siteStateFilter)
  );
  const l1Staff = staffList.filter(s => s.role === 'L1' || s.role === 'Admin');

  const createReport = useMutation({
    mutationFn: (data) => base44.entities.ServiceReport.create(data),
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['service-reports'] });
      navigate(`/reports/${report.id}`);
    },
  });

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleClientChange = (id) => {
    const c = clients.find(c => c.id === id);
    setForm(f => ({ ...f, client_id: id, client_name: c?.company_name || '', site_id: '', site_name: '', site_location: '' }));
  };

  const handleSiteChange = (id) => {
    const s = sites.find(s => s.id === id);
    setForm(f => ({ ...f, site_id: id, site_name: s?.site_name || '', site_location: s?.site_location || '' }));
  };

  const handleStaffChange = (id) => {
    const s = staffList.find(s => s.id === id);
    if (s) setForm(f => ({ ...f, l1_attended_staff_name: s.name, l1_attended_staff_id: s.staff_id, l1_attended_staff_email: s.email || '' }));
  };

  const updateItem = (i, field, val) => setAffectedItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const addItem = () => setAffectedItems(prev => [...prev, emptyItem()]);
  const removeItem = (i) => setAffectedItems(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (l1Status) => {
    if (!form.client_id) { toast.error('Please select a client'); return; }
    if (!form.reported_by) { toast.error('Please enter reported by'); return; }
    if (!form.l1_attended_staff_name) { toast.error('Please select attending staff'); return; }
    if (affectedItems.every(i => !i.device_type)) { toast.error('Please add at least one affected item'); return; }

    const status = l1Status === 'resolved' ? 'resolved' : 'escalated';
    createReport.mutate({
      ...form,
      l1_status: l1Status,
      status,
      l1_affected_items: affectedItems.filter(i => i.device_type),
      l1_submitted: true,
      l1_submitted_at: new Date().toISOString(),
    });

    if (l1Status === 'resolved') toast.success('Report submitted — marking as resolved');
    else toast.success('Report saved — escalating to L2');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
          <ArrowLeft size={16} className="mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold">New Service Report — L1</h1>
          <p className="text-xs font-mono text-primary mt-0.5">{form.running_number}</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Job Info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionHeader title="Job Information" subtitle="Client and site details" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company / Client" required>
              <Select value={form.client_id} onValueChange={handleClientChange}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Region">
              <Select value={siteRegionFilter || undefined} onValueChange={v => { setSiteRegionFilter(v); setSiteStateFilter(''); setForm(f => ({ ...f, site_id: '', site_name: '', site_location: '' })); }}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="All regions" /></SelectTrigger>
                <SelectContent>{regionOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              {siteRegionFilter && <button type="button" onClick={() => { setSiteRegionFilter(''); setSiteStateFilter(''); }} className="text-xs text-muted-foreground hover:text-foreground mt-1">✕ Clear</button>}
            </Field>
            <Field label="State">
              <Select value={siteStateFilter || undefined} onValueChange={v => { setSiteStateFilter(v); setForm(f => ({ ...f, site_id: '', site_name: '', site_location: '' })); }}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="All states" /></SelectTrigger>
                <SelectContent>{stateOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              {siteStateFilter && <button type="button" onClick={() => setSiteStateFilter('')} className="text-xs text-muted-foreground hover:text-foreground mt-1">✕ Clear</button>}
            </Field>
            <Field label="Site Name" required>
              <Select value={form.site_id} onValueChange={handleSiteChange}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.site_name}{s.state ? ` — ${s.state}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Site Location">
              <Input value={form.site_location} onChange={e => setF('site_location', e.target.value)} placeholder="Address / location" className="bg-background" />
            </Field>
            <Field label="DO Number">
              <Input value={form.do_number} onChange={e => setF('do_number', e.target.value)} placeholder="DO-XXXX" className="bg-background" />
            </Field>
            <Field label="Reported By" required>
              <Input value={form.reported_by} onChange={e => setF('reported_by', e.target.value)} placeholder="Name of reporter" className="bg-background" />
            </Field>
          </div>
        </div>

        {/* L1 Support */}
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionHeader title="L1 Remote Support" subtitle="Remote support attendance details" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Field label="L1 Report Number">
              <Input value={form.running_number} readOnly className="bg-muted font-mono text-xs" />
            </Field>
            <Field label="Response ID">
              <Input value={form.l1_attended_staff_id} onChange={e => setF('l1_attended_staff_id', e.target.value)} className="bg-background font-mono" placeholder="Response ID" />
            </Field>
            <Field label="Date">
              <Input type="date" value={form.l1_date} onChange={e => setF('l1_date', e.target.value)} className="bg-background" />
            </Field>
            <Field label="Attended By (Staff)" required>
              <Select onValueChange={handleStaffChange}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select L1 staff" /></SelectTrigger>
                <SelectContent>
                  {l1Staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.staff_id})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Staff Name">
              <Input value={form.l1_attended_staff_name} onChange={e => setF('l1_attended_staff_name', e.target.value)} className="bg-background" />
            </Field>
            <Field label="Staff Email">
              <Input value={form.l1_attended_staff_email} onChange={e => setF('l1_attended_staff_email', e.target.value)} placeholder="staff@clickix.com" className="bg-background" />
            </Field>
          </div>

          {/* L1 Remarks */}
          <div className="mb-6">
            <Field label="Remarks / Notes">
              <Textarea value={form.l1_remarks} onChange={e => setF('l1_remarks', e.target.value)} placeholder="Any additional remarks or notes for this L1 session..." className="bg-background resize-none" rows={3} />
            </Field>
          </div>

          {/* Affected Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Affected Hardware / Software</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
                <Plus size={12} /> Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {affectedItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Select value={item.device_type} onValueChange={v => updateItem(i, 'device_type', v)}>
                      <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Device Type" /></SelectTrigger>
                      <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={item.device_name} onChange={e => updateItem(i, 'device_name', e.target.value)} placeholder="Device name / ID" className="bg-background text-xs h-8" />
                    <Input value={item.issue_description} onChange={e => updateItem(i, 'issue_description', e.target.value)} placeholder="Issue description" className="bg-background text-xs h-8" />
                  </div>
                  {affectedItems.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive mt-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Actions */}
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionHeader title="L1 Resolution" subtitle="Mark the outcome of this remote support session" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleSubmit('resolved')}
              disabled={createReport.isPending}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors text-left"
            >
              <CheckCircle size={24} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-400 text-sm">Resolved</p>
                <p className="text-xs text-muted-foreground mt-0.5">Issue resolved remotely. Submit report and notify admin.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('escalate')}
              disabled={createReport.isPending}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-colors text-left"
            >
              <AlertTriangle size={24} className="text-amber-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-400 text-sm">Escalate to L2</p>
                <p className="text-xs text-muted-foreground mt-0.5">Issue requires onsite support. Escalate to L2 team.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}