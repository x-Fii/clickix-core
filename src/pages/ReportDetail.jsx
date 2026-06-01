import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/StatusBadge';
import SignaturePad from '@/components/SignaturePad';
import { ArrowLeft, Download, Send, Plus, X, Upload, Edit2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DEVICE_TYPES = ['PC', 'TV', 'Network Device', 'Cabling', 'CMS Software', 'Other'];
const L2_FLOW = ['escalated', 'quote', 'approved', 'schedule', 'complete'];

const SectionHeader = ({ title, subtitle }) => (
  <div className="pb-3 mb-5 border-b border-border">
    <h3 className="font-semibold text-sm">{title}</h3>
    {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
  </div>
);

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</Label>
    {children}
  </div>
);

const ReadField = ({ label, value }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mb-1">{label}</p>
    <p className="text-sm">{value || <span className="text-muted-foreground/50">—</span>}</p>
  </div>
);

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [l2Form, setL2Form] = useState({});
  const [l2Items, setL2Items] = useState([]);
  const [l2Addons, setL2Addons] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [signature, setSignature] = useState('');
  const [ackName, setAckName] = useState('');
  const [ackPhone, setAckPhone] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [supportingDocs, setSupportingDocs] = useState([]);

  const { data: report, isLoading } = useQuery({
    queryKey: ['service-report', id],
    queryFn: async () => {
      const r = await base44.entities.ServiceReport.get(id);
      setL2Form({
        l2_job_description: r.l2_job_description || '',
        l2_work_detail: r.l2_work_detail || '',
        l2_remarks: r.l2_remarks || '',
        l2_attended_staff_name: r.l2_attended_staff_name || '',
        l2_attended_staff_id: r.l2_attended_staff_id || '',
        l2_attended_staff_email: r.l2_attended_staff_email || '',
        l2_attend_date: r.l2_attend_date || '',
        l2_attend_time: r.l2_attend_time || '',
        l2_approver_name: r.l2_approver_name || '',
        l2_approver_email: r.l2_approver_email || r.l2_approver_detail || '',
        l2_work_order_number: r.l2_work_order_number || '',
        l2_site_pic_name: r.l2_site_pic_name || '',
        l2_site_pic_id: r.l2_site_pic_id || '',
        quote_date: r.quote_date || '',
        approved_date: r.approved_date || '',
        scheduled_date: r.scheduled_date || '',
      });
      setL2Items(r.l2_items?.length ? r.l2_items : (r.l1_affected_items || []).map(i => ({ ...i, rectification_steps: '', photos: [] })));
      setL2Addons(r.l2_addon_items || []);
      setReplacements(r.l2_replacements || []);
      setSignature(r.ack_signature || '');
      setAckName(r.ack_name || '');
      setAckPhone(r.ack_phone || '');
      setSupportingDocs(r.supporting_documents || []);
      return r;
    },
    enabled: !!id,
  });

  const updateReport = useMutation({
    mutationFn: (data) => base44.entities.ServiceReport.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-report', id] });
      queryClient.invalidateQueries({ queryKey: ['service-reports'] });
      setEditing(false);
      toast.success('Report saved');
    },
  });

  const { data: staffList = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.StaffMember.list() });
  const l2Staff = staffList.filter(s => s.role === 'L2' || s.role === 'Admin');

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  if (!report) return <div className="p-6 text-muted-foreground">Report not found.</div>;

  const isL2Stage = L2_FLOW.includes(report.status);
  const canEdit = report.status !== 'resolved';

  const setLF = (key, val) => setL2Form(f => ({ ...f, [key]: val }));
  const updateL2Item = (i, field, val) => setL2Items(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const addL2Addon = () => setL2Addons(prev => [...prev, { device_type: '', device_name: '', issue_description: '', photos: [] }]);
  const updateAddon = (i, field, val) => setL2Addons(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const addReplacement = () => setReplacements(prev => [...prev, { item_description: '', old_item_detail: '', new_item_detail: '' }]);
  const updateReplacement = (i, field, val) => setReplacements(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handlePhotoUpload = async (type, index, files) => {
    const file = files[0];
    if (!file) return;
    setUploadingPhoto(`${type}-${index}`);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (type === 'l2item') updateL2Item(index, 'photos', [...(l2Items[index].photos || []), file_url]);
    if (type === 'addon') updateAddon(index, 'photos', [...(l2Addons[index].photos || []), file_url]);
    setUploadingPhoto(null);
  };

  const handleDocUpload = async (files) => {
    const file = files[0];
    if (!file) return;
    setUploadingDoc(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setSupportingDocs(prev => [...prev, file_url]);
    setUploadingDoc(false);
  };

  const handleStaffSelect = (staffId) => {
    const s = staffList.find(x => x.id === staffId);
    if (s) setL2Form(f => ({ ...f, l2_attended_staff_name: s.name, l2_attended_staff_id: s.staff_id, l2_attended_staff_email: s.email || '' }));
  };

  const saveL2 = () => {
    updateReport.mutate({
      ...l2Form,
      l2_items: l2Items,
      l2_addon_items: l2Addons,
      l2_replacements: replacements,
      supporting_documents: supportingDocs,
    });
  };

  const advanceStatus = (newStatus, extraData = {}) => {
    updateReport.mutate({ status: newStatus, ...extraData });
  };

  const handleComplete = () => {
    if (!ackName || !ackPhone) { toast.error('Acknowledgement name and phone are required'); return; }
    updateReport.mutate({
      ...l2Form,
      l2_items: l2Items,
      l2_addon_items: l2Addons,
      l2_replacements: replacements,
      supporting_documents: supportingDocs,
      status: 'complete',
      ack_signature: signature,
      ack_name: ackName,
      ack_phone: ackPhone,
      ack_timestamp: new Date().toISOString(),
    });
  };

  const handleSubmitToAdmin = async () => {
    const adminEmail = prompt('Enter admin email address:');
    if (!adminEmail) return;
    try {
      await base44.integrations.Core.SendEmail({
        to: adminEmail,
        subject: `Service Report ${report.running_number} — ${report.status?.toUpperCase()}`,
        body: `Service Report Submission\n\nReport No: ${report.running_number}\nClient: ${report.client_name}\nSite: ${report.site_name}\nStatus: ${report.status}\nDate: ${format(new Date(report.created_date), 'dd MMM yyyy')}\n\nL1 Staff: ${report.l1_attended_staff_name}\nL1 Status: ${report.l1_status}\n\nPlease log in to the system to view the full report details.`,
      });
      updateReport.mutate({ submitted: true, submitted_at: new Date().toISOString(), admin_email: adminEmail });
      toast.success(`Report submitted to ${adminEmail}`);
    } catch {
      toast.error('Failed to send email');
    }
  };

  const handleExportPDF = async () => {
    toast.info('Generating PDF...');
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const el = document.getElementById('pdf-print-area');
    el.style.display = 'block';
    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 });
    el.style.display = 'none';
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pw) / canvas.width;
    let remaining = imgH;
    let pos = 0;
    pdf.addImage(imgData, 'PNG', 0, pos, pw, imgH);
    remaining -= ph;
    while (remaining > 0) {
      pos -= ph;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, pos, pw, imgH);
      remaining -= ph;
    }
    pdf.save(`${report.running_number}.pdf`);
    toast.success('PDF exported');
  };

  const statusIdx = L2_FLOW.indexOf(report.status);

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
            <ArrowLeft size={16} className="mr-2" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold font-mono">{report.running_number}</h1>
              <StatusBadge status={report.status} size="md" />
              {report.submitted && <span className="text-xs text-emerald-400 font-mono">✓ Submitted</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{report.client_name} · {report.site_name}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)} className="gap-2">
              <Edit2 size={14} /> {editing ? 'Cancel Edit' : 'Edit'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <Download size={14} /> PDF
          </Button>
          <Button size="sm" onClick={handleSubmitToAdmin} className="gap-2">
            <Send size={14} /> Submit to Admin
          </Button>
        </div>
      </div>

      {/* L2 Status Workflow Bar */}
      {isL2Stage && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-4">L2 Workflow Progress</p>
          <div className="flex items-center gap-0">
            {L2_FLOW.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex flex-col items-center ${i < L2_FLOW.length - 1 ? 'flex-1' : ''}`}>
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-mono transition-all ${
                    i < statusIdx ? 'border-primary bg-primary text-white' :
                    i === statusIdx ? 'border-primary bg-primary/20 text-primary' :
                    'border-border bg-muted text-muted-foreground'
                  }`}>{i + 1}</div>
                  <span className={`text-[10px] mt-1 font-mono hidden sm:block ${i <= statusIdx ? 'text-primary' : 'text-muted-foreground'}`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                </div>
                {i < L2_FLOW.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 -mt-4 ${i < statusIdx ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Status action buttons */}
          <div className="mt-5 pt-4 border-t border-border flex flex-wrap gap-3">
            {report.status === 'escalated' && (
              <div className="flex items-center gap-2">
                <Input type="date" className="w-40 h-8 text-xs bg-background" value={l2Form.quote_date} onChange={e => setLF('quote_date', e.target.value)} />
                <Button size="sm" onClick={() => advanceStatus('quote', { quote_date: l2Form.quote_date })} disabled={!l2Form.quote_date}>
                  Submit Quotation →
                </Button>
              </div>
            )}
            {report.status === 'quote' && (
              <div className="flex items-center gap-2">
                <Input type="date" className="w-40 h-8 text-xs bg-background" value={l2Form.approved_date} onChange={e => setLF('approved_date', e.target.value)} />
                <Button size="sm" onClick={() => advanceStatus('approved', { approved_date: l2Form.approved_date })} disabled={!l2Form.approved_date}>
                  Mark Approved →
                </Button>
              </div>
            )}
            {report.status === 'approved' && (
              <div className="flex items-center gap-2">
                <Input type="date" className="w-40 h-8 text-xs bg-background" value={l2Form.scheduled_date} onChange={e => setLF('scheduled_date', e.target.value)} />
                <Button size="sm" onClick={() => advanceStatus('schedule', { scheduled_date: l2Form.scheduled_date })} disabled={!l2Form.scheduled_date}>
                  Schedule Visit →
                </Button>
              </div>
            )}
            {report.status === 'schedule' && (
              <Button size="sm" onClick={handleComplete} className="bg-emerald-600 hover:bg-emerald-700">
                ✓ Mark Complete
              </Button>
            )}
            {report.status !== 'complete' && isL2Stage && (
              <Button variant="outline" size="sm" onClick={saveL2}>
                <Save size={14} className="mr-2" /> Save Draft
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Job Info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <SectionHeader title="Job Information" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ReadField label="Client" value={report.client_name} />
            <ReadField label="Site Name" value={report.site_name} />
            <ReadField label="Site Location" value={report.site_location} />
            <ReadField label="Reported By" value={report.reported_by} />
            <ReadField label="Report Date" value={report.l1_date} />
            <ReadField label="Created" value={report.created_date ? format(new Date(report.created_date), 'dd MMM yyyy HH:mm') : ''} />
          </div>
        </div>

        {/* L1 Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="pb-3 border-b border-border flex-1">
              <h3 className="font-semibold text-sm">L1 Remote Support</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Remote attendance record</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <ReadField label="L1 Staff" value={report.l1_attended_staff_name} />
            <ReadField label="Staff ID" value={report.l1_attended_staff_id} />
            <ReadField label="Staff Email" value={report.l1_attended_staff_email} />
            <ReadField label="Date" value={report.l1_date} />
            <ReadField label="L1 Status" value={report.l1_status ? report.l1_status.charAt(0).toUpperCase() + report.l1_status.slice(1) : ''} />
          </div>
          {(report.l1_affected_items || []).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">Affected Items</p>
              <div className="space-y-2">
                {report.l1_affected_items.map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                    <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded flex-shrink-0 h-fit">{item.device_type}</span>
                    <span className="font-medium flex-shrink-0">{item.device_name}</span>
                    <span className="text-muted-foreground">{item.issue_description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* L2 Section */}
        {isL2Stage && (
          <>
            <div className="bg-card border border-border rounded-xl p-6">
              <SectionHeader title="L2 Onsite Support — Job Details" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <Field label="Job Description / Work Detail">
                    <Textarea value={l2Form.l2_job_description} onChange={e => setLF('l2_job_description', e.target.value)} className="bg-background resize-none" rows={4} readOnly={report.status === 'complete' && !editing} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Remarks">
                    <Textarea value={l2Form.l2_remarks} onChange={e => setLF('l2_remarks', e.target.value)} className="bg-background resize-none" rows={2} readOnly={report.status === 'complete' && !editing} />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Attended By (L2 Staff)">
                  <Select onValueChange={handleStaffSelect}>
                    <SelectTrigger className="bg-background text-sm"><SelectValue placeholder={l2Form.l2_attended_staff_name || 'Select staff'} /></SelectTrigger>
                    <SelectContent>{l2Staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Staff ID"><Input value={l2Form.l2_attended_staff_id} onChange={e => setLF('l2_attended_staff_id', e.target.value)} className="bg-background" /></Field>
                <Field label="Staff Email"><Input value={l2Form.l2_attended_staff_email} onChange={e => setLF('l2_attended_staff_email', e.target.value)} className="bg-background" /></Field>
                <Field label="Attend Date"><Input type="date" value={l2Form.l2_attend_date} onChange={e => setLF('l2_attend_date', e.target.value)} className="bg-background" /></Field>
                <Field label="Attend Time"><Input type="time" value={l2Form.l2_attend_time} onChange={e => setLF('l2_attend_time', e.target.value)} className="bg-background" /></Field>
                <Field label="Work Order No."><Input value={l2Form.l2_work_order_number} onChange={e => setLF('l2_work_order_number', e.target.value)} className="bg-background" /></Field>
                <Field label="Approver Name"><Input value={l2Form.l2_approver_name} onChange={e => setLF('l2_approver_name', e.target.value)} className="bg-background" /></Field>
                <Field label="Approver Email"><Input type="email" value={l2Form.l2_approver_email} onChange={e => setLF('l2_approver_email', e.target.value)} className="bg-background" /></Field>
                <ReadField label="Approved Date" value={report.approved_date || l2Form.approved_date} />
                <Field label="Site PIC Name"><Input value={l2Form.l2_site_pic_name} onChange={e => setLF('l2_site_pic_name', e.target.value)} className="bg-background" /></Field>
                <Field label="Site PIC ID"><Input value={l2Form.l2_site_pic_id} onChange={e => setLF('l2_site_pic_id', e.target.value)} className="bg-background" /></Field>
              </div>
            </div>

            {/* L2 Items — continuation of L1 */}
            <div className="bg-card border border-border rounded-xl p-6">
              <SectionHeader title="L1 Items — Onsite Rectification" subtitle="Continuation of L1 affected items with onsite action" />
              <div className="space-y-4">
                {l2Items.map((item, i) => (
                  <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded">{item.device_type}</span>
                      <span className="text-sm font-medium">{item.device_name}</span>
                      <span className="text-sm text-muted-foreground">{item.issue_description}</span>
                    </div>
                    <Field label="Onsite Rectification Steps">
                      <Textarea value={item.rectification_steps} onChange={e => updateL2Item(i, 'rectification_steps', e.target.value)} className="bg-background resize-none text-sm" rows={2} placeholder="Describe steps taken onsite..." />
                    </Field>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Photo Evidence</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(item.photos || []).map((url, pi) => (
                          <img key={pi} src={url} alt="" className="w-20 h-20 object-cover rounded border border-border" />
                        ))}
                        <label className="w-20 h-20 border-2 border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                          {uploadingPhoto === `l2item-${i}` ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload size={14} className="text-muted-foreground" />}
                          <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload('l2item', i, e.target.files)} />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add-on Items */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-sm">Add-On Items (Onsite)</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Additional items found and attended onsite</p>
                </div>
                <Button variant="outline" size="sm" onClick={addL2Addon} className="gap-1 text-xs"><Plus size={12} /> Add Item</Button>
              </div>
              {l2Addons.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No add-on items. Click "Add Item" if there are additional issues found onsite.</p>}
              <div className="space-y-4">
                {l2Addons.map((item, i) => (
                  <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Select value={item.device_type} onValueChange={v => updateAddon(i, 'device_type', v)}>
                        <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Device Type" /></SelectTrigger>
                        <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input value={item.device_name} onChange={e => updateAddon(i, 'device_name', e.target.value)} placeholder="Device name" className="bg-background text-xs h-8" />
                      <Input value={item.issue_description} onChange={e => updateAddon(i, 'issue_description', e.target.value)} placeholder="Issue description" className="bg-background text-xs h-8" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(item.photos || []).map((url, pi) => (
                        <img key={pi} src={url} alt="" className="w-16 h-16 object-cover rounded border border-border" />
                      ))}
                      <label className="w-16 h-16 border-2 border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:border-primary">
                        {uploadingPhoto === `addon-${i}` ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload size={12} className="text-muted-foreground" />}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload('addon', i, e.target.files)} />
                      </label>
                      <button type="button" onClick={() => setL2Addons(p => p.filter((_, idx) => idx !== i))} className="w-16 h-16 border border-border rounded flex items-center justify-center text-muted-foreground hover:text-destructive">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Replacements */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-sm">Replacement Items</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Parts or devices replaced during onsite visit</p>
                </div>
                <Button variant="outline" size="sm" onClick={addReplacement} className="gap-1 text-xs"><Plus size={12} /> Add Replacement</Button>
              </div>
              {replacements.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No replacements recorded.</p>}
              <div className="space-y-3">
                {replacements.map((r, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                    <Input value={r.item_description} onChange={e => updateReplacement(i, 'item_description', e.target.value)} placeholder="Item description" className="bg-background text-xs" />
                    <Input value={r.old_item_detail} onChange={e => updateReplacement(i, 'old_item_detail', e.target.value)} placeholder="Old item detail (S/N, model)" className="bg-background text-xs" />
                    <div className="flex gap-2">
                      <Input value={r.new_item_detail} onChange={e => updateReplacement(i, 'new_item_detail', e.target.value)} placeholder="New item detail (S/N, model)" className="bg-background text-xs flex-1" />
                      <button onClick={() => setReplacements(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supporting Documents */}
            <div className="bg-card border border-border rounded-xl p-6">
              <SectionHeader title="Supporting Documents" subtitle="Attach any supporting files or documents" />
              <div className="flex flex-wrap gap-3">
                {supportingDocs.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border text-xs text-primary hover:underline">
                    <Download size={12} /> Document {i + 1}
                  </a>
                ))}
                <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary text-xs text-muted-foreground transition-colors">
                  {uploadingDoc ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload size={12} />}
                  Attach Document
                  <input type="file" className="hidden" onChange={e => handleDocUpload(e.target.files)} />
                </label>
              </div>
            </div>

            {/* Acknowledgement */}
            <div className="bg-card border border-border rounded-xl p-6">
              <SectionHeader title="Site Acknowledgement" subtitle="Site PIC signature and confirmation" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <Field label="PIC Name">
                  <Input value={ackName} onChange={e => setAckName(e.target.value)} placeholder="Site PIC full name" className="bg-background" readOnly={report.status === 'complete' && !editing} />
                </Field>
                <Field label="PIC Phone">
                  <Input value={ackPhone} onChange={e => setAckPhone(e.target.value)} placeholder="+60 12-xxx xxxx" className="bg-background" readOnly={report.status === 'complete' && !editing} />
                </Field>
                {report.ack_timestamp && (
                  <ReadField label="Acknowledged At" value={format(new Date(report.ack_timestamp), 'dd MMM yyyy HH:mm')} />
                )}
              </div>
              <Field label="Signature">
                <SignaturePad value={signature} onChange={setSignature} readOnly={report.status === 'complete' && !editing} />
              </Field>
            </div>
          </>
        )}
      </div>

      {/* Hidden PDF Template */}
      <div id="pdf-print-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, width: '794px', background: 'white', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#111' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1e40af', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e40af', letterSpacing: '4px' }}>CLICK IX SDN BHD</h1>
        <p style={{ fontSize: '13px', marginTop: '4px', color: '#374151' }}>SERVICE REPORT — {report.status?.toUpperCase()}</p>
        <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'monospace' }}>{report.running_number} · Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
      </div>

      {/* Job Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '24px' }}>
        {[['Client', report.client_name], ['Site', report.site_name], ['Location', report.site_location], ['Reported By', report.reported_by], ['Date', report.l1_date], ['Status', report.status?.toUpperCase()]].map(([k, v]) => (
          <div key={k} style={{ padding: '8px', background: '#f9fafb', borderRadius: '4px' }}>
            <p style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>{k}</p>
            <p style={{ fontWeight: '600', marginTop: '2px' }}>{v || '—'}</p>
          </div>
        ))}
      </div>

      {/* L1 Section */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af', borderBottom: '1px solid #dbeafe', paddingBottom: '6px', marginBottom: '10px' }}>L1 REMOTE SUPPORT</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
          {[['Staff', report.l1_attended_staff_name], ['ID', report.l1_attended_staff_id], ['Email', report.l1_attended_staff_email], ['Date', report.l1_date], ['L1 Status', report.l1_status ? report.l1_status.charAt(0).toUpperCase() + report.l1_status.slice(1) : '']].map(([k, v]) => (
            <div key={k} style={{ padding: '6px', background: '#f9fafb', borderRadius: '4px' }}>
              <p style={{ color: '#6b7280', fontSize: '10px' }}>{k}</p>
              <p style={{ fontWeight: '600' }}>{v || '—'}</p>
            </div>
          ))}
        </div>
        {(report.l1_affected_items || []).map((item, i) => (
          <div key={i} style={{ marginTop: '8px', padding: '8px', background: '#eff6ff', borderRadius: '4px', fontSize: '12px', display: 'flex', gap: '12px' }}>
            <span style={{ fontWeight: 'bold', color: '#1e40af' }}>{item.device_type}</span>
            <span style={{ fontWeight: '600' }}>{item.device_name}</span>
            <span style={{ color: '#374151' }}>{item.issue_description}</span>
          </div>
        ))}
      </div>

      {/* L2 Section */}
      {isL2Stage && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af', borderBottom: '1px solid #dbeafe', paddingBottom: '6px', marginBottom: '10px' }}>L2 ONSITE SUPPORT</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '10px' }}>
            {[['Staff', report.l2_attended_staff_name], ['ID', report.l2_attended_staff_id], ['Date', report.l2_attend_date], ['Time', report.l2_attend_time], ['Work Order', report.l2_work_order_number], ['Approver', report.l2_approver_name], ['Approver Email', report.l2_approver_email || report.l2_approver_detail], ['Approved Date', report.approved_date]].map(([k, v]) => (
            <div key={k} style={{ padding: '6px', background: '#f9fafb', borderRadius: '4px' }}>
              <p style={{ color: '#6b7280', fontSize: '10px' }}>{k}</p>
              <p style={{ fontWeight: '600' }}>{v || '—'}</p>
            </div>
          ))}
          </div>
          {report.l2_job_description && <div style={{ marginBottom: '8px', fontSize: '12px', padding: '8px', background: '#f9fafb', borderRadius: '4px' }}><strong>Job Description / Work Detail:</strong><br />{report.l2_job_description}</div>}
          {report.l2_remarks && <div style={{ fontSize: '12px', padding: '8px', background: '#f9fafb', borderRadius: '4px' }}><strong>Remarks:</strong> {report.l2_remarks}</div>}

          {/* L2 Items (L1 items with rectification) */}
          {(report.l2_items || []).length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>L1 Items — Onsite Rectification</h4>
              {(report.l2_items || []).map((item, i) => (
                <div key={i} style={{ marginBottom: '12px', padding: '10px', border: '1px solid #dbeafe', borderRadius: '4px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: '#1e40af', background: '#eff6ff', padding: '2px 6px', borderRadius: '3px' }}>{item.device_type}</span>
                    <span style={{ fontWeight: '600' }}>{item.device_name}</span>
                    <span style={{ color: '#374151' }}>{item.issue_description}</span>
                  </div>
                  {item.rectification_steps && <p style={{ color: '#374151', marginBottom: '8px' }}><strong>Rectification:</strong> {item.rectification_steps}</p>}
                  {(item.photos || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {item.photos.map((url, pi) => (
                        <img key={pi} src={url} alt={`photo-${pi}`} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }} crossOrigin="anonymous" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add-on Items */}
          {(report.l2_addon_items || []).length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Add-On Items (Onsite)</h4>
              {(report.l2_addon_items || []).map((item, i) => (
                <div key={i} style={{ marginBottom: '12px', padding: '10px', border: '1px solid #d1fae5', borderRadius: '4px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: '#065f46', background: '#d1fae5', padding: '2px 6px', borderRadius: '3px' }}>{item.device_type}</span>
                    <span style={{ fontWeight: '600' }}>{item.device_name}</span>
                    <span style={{ color: '#374151' }}>{item.issue_description}</span>
                  </div>
                  {(item.photos || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {item.photos.map((url, pi) => (
                        <img key={pi} src={url} alt={`addon-photo-${pi}`} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }} crossOrigin="anonymous" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Replacements */}
          {(report.l2_replacements || []).length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>Replacement Items</h4>
              {report.l2_replacements.map((r, i) => (
                <div key={i} style={{ marginBottom: '6px', padding: '8px', background: '#fefce8', borderRadius: '4px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div><p style={{ color: '#6b7280', fontSize: '10px' }}>Item</p><p style={{ fontWeight: '600' }}>{r.item_description}</p></div>
                  <div><p style={{ color: '#6b7280', fontSize: '10px' }}>Old</p><p>{r.old_item_detail}</p></div>
                  <div><p style={{ color: '#6b7280', fontSize: '10px' }}>New</p><p>{r.new_item_detail}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Supporting Documents */}
      {(report.supporting_documents || []).length > 0 && (
        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af', borderBottom: '1px solid #dbeafe', paddingBottom: '6px', marginBottom: '10px' }}>SUPPORTING DOCUMENTS</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {report.supporting_documents.map((url, i) => {
              const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              return isImage ? (
                <img key={i} src={url} alt={`doc-${i+1}`} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }} crossOrigin="anonymous" />
              ) : (
                <div key={i} style={{ padding: '10px 16px', background: '#f3f4f6', borderRadius: '4px', fontSize: '11px', color: '#374151', border: '1px solid #e5e7eb' }}>📎 Document {i + 1}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Acknowledgement */}
      {report.ack_name && (
        <div style={{ marginTop: '20px', borderTop: '2px solid #1e40af', paddingTop: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af', marginBottom: '10px' }}>ACKNOWLEDGEMENT</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
            <div><p style={{ color: '#6b7280', fontSize: '10px' }}>PIC Name</p><p style={{ fontWeight: '600' }}>{report.ack_name}</p></div>
            <div><p style={{ color: '#6b7280', fontSize: '10px' }}>Phone</p><p style={{ fontWeight: '600' }}>{report.ack_phone}</p></div>
            <div><p style={{ color: '#6b7280', fontSize: '10px' }}>Timestamp</p><p style={{ fontWeight: '600' }}>{report.ack_timestamp ? format(new Date(report.ack_timestamp), 'dd MMM yyyy HH:mm') : '—'}</p></div>
          </div>
          {report.ack_signature && <div style={{ marginTop: '12px' }}><p style={{ color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}>SIGNATURE</p><img src={report.ack_signature} alt="signature" style={{ border: '1px solid #e5e7eb', borderRadius: '4px', maxHeight: '80px' }} /></div>}
        </div>
      )}
      </div>
      </div>
      );
      }