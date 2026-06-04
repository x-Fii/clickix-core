import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Upload, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const DEVICE_TYPES = ['PC', 'TV', 'Network Device', 'Cabling', 'CMS Software', 'Other'];

function generateReportNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `IR-${y}${m}${d}-${rand}`;
}

const blankInstalled = () => ({ device_type: '', device_name: '', serial_number: '', notes: '', photos: [] });
const blankDecomm = () => ({ device_type: '', device_name: '', serial_number: '', reason_for_decommission: '', photos: [] });

export default function InstallationReportForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!id;

  const [form, setForm] = useState({
    report_number: generateReportNumber(),
    report_type: 'commissioning',
    status: 'pending',
    client_id: '', client_name: '',
    site_id: '', site_name: '', site_location: '',
    reported_by: '',
    scheduled_date: '', installation_date: '', attend_time: '',
    attended_staff_name: '', attended_staff_id: '', attended_staff_email: '',
    work_order_number: '', site_pic_name: '',
    equipment_installed: [blankInstalled()],
    equipment_decommissioned: [],
    technician_notes: '',
    supporting_documents: [],
    ack_signature: '', ack_name: '', ack_phone: '', ack_timestamp: '',
    submitted: false, submitted_at: '', admin_email: '',
  });

  const [uploading, setUploading] = useState(false);

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.StaffMember.list() });

  const { data: existing } = useQuery({
    queryKey: ['installation-report', id],
    queryFn: () => base44.entities.InstallationReport.filter({ id }),
    enabled: isEdit,
    select: data => data[0],
  });

  useEffect(() => {
    if (existing) setForm({ ...form, ...existing });
  }, [existing]);

  const filteredSites = sites.filter(s => !form.client_id || s.client_id === form.client_id);

  const mutation = useMutation({
    mutationFn: data => isEdit
      ? base44.entities.InstallationReport.update(id, data)
      : base44.entities.InstallationReport.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['installation-reports']);
      toast({ title: isEdit ? 'Report updated' : 'Report created' });
      navigate(`/installation/${result.id || id}`);
    },
  });

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  // Equipment installed helpers
  const addInstalled = () => set('equipment_installed', [...form.equipment_installed, blankInstalled()]);
  const removeInstalled = i => set('equipment_installed', form.equipment_installed.filter((_, idx) => idx !== i));
  const updateInstalled = (i, field, val) => {
    const arr = [...form.equipment_installed];
    arr[i] = { ...arr[i], [field]: val };
    set('equipment_installed', arr);
  };

  // Equipment decommissioned helpers
  const addDecomm = () => set('equipment_decommissioned', [...form.equipment_decommissioned, blankDecomm()]);
  const removeDecomm = i => set('equipment_decommissioned', form.equipment_decommissioned.filter((_, idx) => idx !== i));
  const updateDecomm = (i, field, val) => {
    const arr = [...form.equipment_decommissioned];
    arr[i] = { ...arr[i], [field]: val };
    set('equipment_decommissioned', arr);
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('supporting_documents', [...form.supporting_documents, file_url]);
    setUploading(false);
  };

  const handlePhotoUpload = async (e, section, idx) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (section === 'installed') {
      const arr = [...form.equipment_installed];
      arr[idx] = { ...arr[idx], photos: [...(arr[idx].photos || []), file_url] };
      set('equipment_installed', arr);
    } else {
      const arr = [...form.equipment_decommissioned];
      arr[idx] = { ...arr[idx], photos: [...(arr[idx].photos || []), file_url] };
      set('equipment_decommissioned', arr);
    }
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const sectionClass = 'bg-card border border-border rounded-xl p-5 space-y-4';
  const rowClass = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

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
        {/* Basic Info */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Report Info</h2>
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Work Order Number</Label>
              <Input value={form.work_order_number} onChange={e => set('work_order_number', e.target.value)} placeholder="WO-XXXX" />
            </div>
            <div className="space-y-1">
              <Label>Reported By</Label>
              <Input value={form.reported_by} onChange={e => set('reported_by', e.target.value)} placeholder="Name" />
            </div>
          </div>
        </div>

        {/* Client & Site */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Client & Site</h2>
          <div className={rowClass}>
            <div className="space-y-1">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={v => {
                const c = clients.find(x => x.id === v);
                setForm(f => ({ ...f, client_id: v, client_name: c?.company_name || '', site_id: '', site_name: '', site_location: '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Site / Outlet</Label>
              <Select value={form.site_id} onValueChange={v => {
                const s = sites.find(x => x.id === v);
                setForm(f => ({ ...f, site_id: v, site_name: s?.site_name || '', site_location: s?.site_location || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>{filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.site_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Site Location</Label>
              <Input value={form.site_location} onChange={e => set('site_location', e.target.value)} placeholder="Address" />
            </div>
            <div className="space-y-1">
              <Label>Site PIC Name</Label>
              <Input value={form.site_pic_name} onChange={e => set('site_pic_name', e.target.value)} placeholder="Person in charge" />
            </div>
          </div>
        </div>

        {/* Schedule & Attendance */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Schedule & Attendance</h2>
          <div className={rowClass}>
            <div className="space-y-1">
              <Label>Scheduled Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Actual Installation Date</Label>
              <Input type="date" value={form.installation_date} onChange={e => set('installation_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Attend Time</Label>
              <Input type="time" value={form.attend_time} onChange={e => set('attend_time', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Technician</Label>
              <Select value={form.attended_staff_id} onValueChange={v => {
                const s = staff.find(x => x.id === v);
                setForm(f => ({ ...f, attended_staff_id: v, attended_staff_name: s?.name || '', attended_staff_email: s?.email || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Equipment Installed */}
        {(form.report_type === 'commissioning' || form.report_type === 'decommissioning') && (
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                {form.report_type === 'commissioning' ? 'Equipment Installed' : 'Equipment Decommissioned'}
              </h2>
              <Button type="button" size="sm" variant="outline" onClick={form.report_type === 'commissioning' ? addInstalled : addDecomm}>
                <Plus size={14} className="mr-1" /> Add Item
              </Button>
            </div>
            {(form.report_type === 'commissioning' ? form.equipment_installed : form.equipment_decommissioned).map((item, i) => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-3 relative bg-muted/10">
                <button type="button" onClick={() => form.report_type === 'commissioning' ? removeInstalled(i) : removeDecomm(i)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                  <Trash2 size={14} />
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Device Type</Label>
                    <Select value={item.device_type} onValueChange={v => form.report_type === 'commissioning' ? updateInstalled(i, 'device_type', v) : updateDecomm(i, 'device_type', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Device Name / Model</Label>
                    <Input className="h-8 text-xs" value={item.device_name} onChange={e => form.report_type === 'commissioning' ? updateInstalled(i, 'device_name', e.target.value) : updateDecomm(i, 'device_name', e.target.value)} placeholder="Name / Model" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Serial Number</Label>
                    <Input className="h-8 text-xs" value={item.serial_number} onChange={e => form.report_type === 'commissioning' ? updateInstalled(i, 'serial_number', e.target.value) : updateDecomm(i, 'serial_number', e.target.value)} placeholder="S/N" />
                  </div>
                </div>
                {form.report_type === 'commissioning' ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input className="h-8 text-xs" value={item.notes} onChange={e => updateInstalled(i, 'notes', e.target.value)} placeholder="Additional notes" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Reason for Decommission</Label>
                    <Input className="h-8 text-xs" value={item.reason_for_decommission} onChange={e => updateDecomm(i, 'reason_for_decommission', e.target.value)} placeholder="Reason" />
                  </div>
                )}
                {/* Photos */}
                <div className="space-y-1">
                  <Label className="text-xs">Photos</Label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {(item.photos || []).map((url, pi) => (
                      <div key={pi} className="relative group">
                        <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-border" />
                        <button type="button" onClick={() => {
                          const arr = form.report_type === 'commissioning' ? [...form.equipment_installed] : [...form.equipment_decommissioned];
                          arr[i] = { ...arr[i], photos: arr[i].photos.filter((_, pi2) => pi2 !== pi) };
                          set(form.report_type === 'commissioning' ? 'equipment_installed' : 'equipment_decommissioned', arr);
                        }} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 hidden group-hover:block">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 border border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                      <Upload size={14} className="text-muted-foreground" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, form.report_type === 'commissioning' ? 'installed' : 'decomm', i)} />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Technician Notes */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Technician Notes</h2>
          <Textarea value={form.technician_notes} onChange={e => set('technician_notes', e.target.value)} placeholder="Describe the work carried out, observations, or any issues encountered…" rows={4} />
        </div>

        {/* Supporting Documents */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-mono">Supporting Documents</h2>
          <div className="space-y-2">
            {form.supporting_documents.map((url, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <a href={url} target="_blank" rel="noreferrer" className="underline truncate max-w-xs">Document {i + 1}</a>
                <button type="button" onClick={() => set('supporting_documents', form.supporting_documents.filter((_, j) => j !== i))} className="text-destructive"><X size={12} /></button>
              </div>
            ))}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-primary hover:underline">
              <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload document'}
              <input type="file" className="hidden" disabled={uploading} onChange={handleDocUpload} />
            </label>
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