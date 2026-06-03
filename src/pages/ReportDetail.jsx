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
  const [companyStamp, setCompanyStamp] = useState('');
  const [uploadingStamp, setUploadingStamp] = useState(false);

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
      setCompanyStamp(r.ack_company_stamp || '');
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
  // Allow editing on all statuses except 'resolved'
  const canEdit = true;

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

  const handleStampUpload = async (files) => {
    const file = files[0];
    if (!file) return;
    setUploadingStamp(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setCompanyStamp(file_url);
    setUploadingStamp(false);
  };

  const handleStaffSelect = (staffId) => {
    const s = staffList.find(x => x.id === staffId);
    if (s) setL2Form(f => ({ ...f, l2_attended_staff_name: s.name, l2_attended_staff_id: s.staff_id, l2_attended_staff_email: s.email || '' }));
  };

  // Save all L2 data including ack fields — works for both draft and completed reports
  const saveL2 = () => {
    updateReport.mutate({
      ...l2Form,
      l2_items: l2Items,
      l2_addon_items: l2Addons,
      l2_replacements: replacements,
      supporting_documents: supportingDocs,
      ack_company_stamp: companyStamp,
      ack_signature: signature,
      ack_name: ackName,
      ack_phone: ackPhone,
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
      ack_company_stamp: companyStamp,
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
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const wrapper = document.getElementById('pdf-print-area');
    wrapper.style.display = 'block';
    // Skip page 3 if no supporting documents
    const hasDocs = supportingDocs.length > 0;
    const pageIds = ['pdf-page-1', 'pdf-page-2', ...(hasDocs ? ['pdf-page-3'] : []), 'pdf-page-4'];
    let isFirstPage = true;
    for (const pageId of pageIds) {
      const el = document.getElementById(pageId);
      if (!el || el.offsetHeight < 5) continue;
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff', width: 794 });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgH = (canvas.height * pw) / canvas.width;
      if (!isFirstPage) pdf.addPage();
      isFirstPage = false;
      let remaining = imgH;
      let pos = 0;
      pdf.addImage(imgData, 'JPEG', 0, pos, pw, imgH);
      remaining -= ph;
      while (remaining > 0) {
        pos -= ph;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, pos, pw, imgH);
        remaining -= ph;
      }
    }
    wrapper.style.display = 'none';
    pdf.save(`${report.running_number}.pdf`);
    toast.success('PDF exported');
  };

  const statusIdx = L2_FLOW.indexOf(report.status);
  const isReadOnly = report.status === 'complete' && !editing;

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
          {/* Show Save button in header when editing a completed report */}
          {editing && report.status === 'complete' && (
            <Button size="sm" onClick={saveL2} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Save size={14} /> Save Changes
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
            {/* Save Draft available for all non-complete statuses, or when editing a complete report */}
            {isL2Stage && (report.status !== 'complete' || editing) && (
              <Button variant="outline" size="sm" onClick={saveL2}>
                <Save size={14} className="mr-2" /> {report.status === 'complete' ? 'Save Changes' : 'Save Draft'}
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
            <ReadField label="Report ID" value={report.running_number} />
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
                    <Textarea value={l2Form.l2_job_description} onChange={e => setLF('l2_job_description', e.target.value)} className="bg-background resize-none" rows={4} readOnly={isReadOnly} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Remarks">
                    <Textarea value={l2Form.l2_remarks} onChange={e => setLF('l2_remarks', e.target.value)} className="bg-background resize-none" rows={2} readOnly={isReadOnly} />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Attended By (L2 Staff)">
                  <Select onValueChange={handleStaffSelect} disabled={isReadOnly}>
                    <SelectTrigger className="bg-background text-sm"><SelectValue placeholder={l2Form.l2_attended_staff_name || 'Select staff'} /></SelectTrigger>
                    <SelectContent>{l2Staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Staff ID"><Input value={l2Form.l2_attended_staff_id} onChange={e => setLF('l2_attended_staff_id', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <Field label="Staff Email"><Input value={l2Form.l2_attended_staff_email} onChange={e => setLF('l2_attended_staff_email', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <Field label="Attend Date"><Input type="date" value={l2Form.l2_attend_date} onChange={e => setLF('l2_attend_date', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <Field label="Attend Time"><Input type="time" value={l2Form.l2_attend_time} onChange={e => setLF('l2_attend_time', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <Field label="Work Order No."><Input value={l2Form.l2_work_order_number} onChange={e => setLF('l2_work_order_number', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <Field label="Approver Name"><Input value={l2Form.l2_approver_name} onChange={e => setLF('l2_approver_name', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <Field label="Approver Email"><Input type="email" value={l2Form.l2_approver_email} onChange={e => setLF('l2_approver_email', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <ReadField label="Approved Date" value={report.approved_date || l2Form.approved_date} />
                <Field label="Site PIC Name"><Input value={l2Form.l2_site_pic_name} onChange={e => setLF('l2_site_pic_name', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
                <Field label="Site PIC ID"><Input value={l2Form.l2_site_pic_id} onChange={e => setLF('l2_site_pic_id', e.target.value)} className="bg-background" readOnly={isReadOnly} /></Field>
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
                      <Textarea value={item.rectification_steps} onChange={e => updateL2Item(i, 'rectification_steps', e.target.value)} className="bg-background resize-none text-sm" rows={2} placeholder="Describe steps taken onsite..." readOnly={isReadOnly} />
                    </Field>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Photo Evidence</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(item.photos || []).map((url, pi) => (
                          <div key={pi} className="relative group">
                            <img src={url} alt="" className="w-20 h-20 object-cover rounded border border-border" />
                            {!isReadOnly && (
                              <button onClick={() => updateL2Item(i, 'photos', item.photos.filter((_, idx) => idx !== pi))} className="absolute top-0 right-0 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={8} />
                              </button>
                            )}
                          </div>
                        ))}
                        {!isReadOnly && (
                          <label className="w-20 h-20 border-2 border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                            {uploadingPhoto === `l2item-${i}` ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload size={14} className="text-muted-foreground" />}
                            <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload('l2item', i, e.target.files)} />
                          </label>
                        )}
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
                {!isReadOnly && <Button variant="outline" size="sm" onClick={addL2Addon} className="gap-1 text-xs"><Plus size={12} /> Add Item</Button>}
              </div>
              {l2Addons.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No add-on items. Click "Add Item" if there are additional issues found onsite.</p>}
              <div className="space-y-4">
                {l2Addons.map((item, i) => (
                  <div key={i} className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Select value={item.device_type} onValueChange={v => updateAddon(i, 'device_type', v)} disabled={isReadOnly}>
                        <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Device Type" /></SelectTrigger>
                        <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input value={item.device_name} onChange={e => updateAddon(i, 'device_name', e.target.value)} placeholder="Device name" className="bg-background text-xs h-8" readOnly={isReadOnly} />
                      <Input value={item.issue_description} onChange={e => updateAddon(i, 'issue_description', e.target.value)} placeholder="Issue description" className="bg-background text-xs h-8" readOnly={isReadOnly} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(item.photos || []).map((url, pi) => (
                        <div key={pi} className="relative group">
                          <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-border" />
                          {!isReadOnly && (
                            <button onClick={() => updateAddon(i, 'photos', item.photos.filter((_, idx) => idx !== pi))} className="absolute top-0 right-0 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={8} />
                            </button>
                          )}
                        </div>
                      ))}
                      {!isReadOnly && (
                        <label className="w-16 h-16 border-2 border-dashed border-border rounded flex items-center justify-center cursor-pointer hover:border-primary">
                          {uploadingPhoto === `addon-${i}` ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload size={12} className="text-muted-foreground" />}
                          <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload('addon', i, e.target.files)} />
                        </label>
                      )}
                      {!isReadOnly && (
                        <button type="button" onClick={() => setL2Addons(p => p.filter((_, idx) => idx !== i))} className="w-16 h-16 border border-border rounded flex items-center justify-center text-muted-foreground hover:text-destructive">
                          <X size={12} />
                        </button>
                      )}
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
                {!isReadOnly && <Button variant="outline" size="sm" onClick={addReplacement} className="gap-1 text-xs"><Plus size={12} /> Add Replacement</Button>}
              </div>
              {replacements.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No replacements recorded.</p>}
              <div className="space-y-3">
                {replacements.map((r, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg border border-border">
                    <Input value={r.item_description} onChange={e => updateReplacement(i, 'item_description', e.target.value)} placeholder="Item description" className="bg-background text-xs" readOnly={isReadOnly} />
                    <Input value={r.old_item_detail} onChange={e => updateReplacement(i, 'old_item_detail', e.target.value)} placeholder="Old item detail (S/N, model)" className="bg-background text-xs" readOnly={isReadOnly} />
                    <div className="flex gap-2">
                      <Input value={r.new_item_detail} onChange={e => updateReplacement(i, 'new_item_detail', e.target.value)} placeholder="New item detail (S/N, model)" className="bg-background text-xs flex-1" readOnly={isReadOnly} />
                      {!isReadOnly && (
                        <button onClick={() => setReplacements(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                          <X size={14} />
                        </button>
                      )}
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
                  <div key={i} className="flex items-center gap-1">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border text-xs text-primary hover:underline">
                      <Download size={12} /> Document {i + 1}
                    </a>
                    {!isReadOnly && (
                      <button onClick={() => setSupportingDocs(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive ml-1">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!isReadOnly && (
                  <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary text-xs text-muted-foreground transition-colors">
                    {uploadingDoc ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload size={12} />}
                    Attach Document
                    <input type="file" className="hidden" onChange={e => handleDocUpload(e.target.files)} />
                  </label>
                )}
              </div>
            </div>

            {/* Acknowledgement */}
            <div className="bg-card border border-border rounded-xl p-6">
              <SectionHeader title="Site Acknowledgement" subtitle="Site PIC signature and confirmation" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <Field label="PIC Name">
                  <Input value={ackName} onChange={e => setAckName(e.target.value)} placeholder="Site PIC full name" className="bg-background" readOnly={isReadOnly} />
                </Field>
                <Field label="PIC Phone">
                  <Input value={ackPhone} onChange={e => setAckPhone(e.target.value)} placeholder="+60 12-xxx xxxx" className="bg-background" readOnly={isReadOnly} />
                </Field>
                {report.ack_timestamp && (
                  <ReadField label="Acknowledged At" value={format(new Date(report.ack_timestamp), 'dd MMM yyyy HH:mm')} />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Signature">
                  <SignaturePad value={signature} onChange={setSignature} readOnly={isReadOnly} />
                </Field>
                <Field label="Company Stamp">
                  {companyStamp ? (
                    <div className="relative inline-block w-full">
                      <img src={companyStamp} alt="Company Stamp" className="w-full max-h-40 object-contain rounded border border-border bg-muted/20" />
                      {!isReadOnly && (
                        <button onClick={() => setCompanyStamp('')} className="absolute top-1 right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"><X size={10} /></button>
                      )}
                    </div>
                  ) : (
                    !isReadOnly && (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded cursor-pointer hover:border-primary transition-colors bg-muted/10">
                        {uploadingStamp ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><Upload size={16} className="text-muted-foreground mb-2" /><span className="text-xs text-muted-foreground">Upload Stamp</span></>}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleStampUpload(e.target.files)} />
                      </label>
                    )
                  )}
                </Field>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hidden PDF Template */}
      <div id="pdf-print-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>

        {/* PAGE 1 — Header + Job Info + L1 */}
        <div id="pdf-page-1" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
          {/* Header */}
          <div style={{ background: '#0f172a', borderRadius: '8px', padding: '24px 28px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#f8fafc', letterSpacing: '3px', margin: 0 }}>CLICK IX SDN BHD</h1>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', letterSpacing: '1px' }}>SERVICE REPORT</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ background: '#f59e0b', color: '#0f172a', fontWeight: '700', fontSize: '13px', padding: '4px 12px', borderRadius: '4px', fontFamily: 'monospace' }}>{report.status?.toUpperCase()}</div>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>{report.running_number}</p>
              <p style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
          </div>

          {/* Job Info Grid */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#f59e0b', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Job Information</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
              {[['Client', report.client_name], ['Site Name', report.site_name], ['Site Location', report.site_location], ['Reported By', report.reported_by], ['Report Date', report.l1_date], ['Created', report.created_date ? format(new Date(report.created_date), 'dd MMM yyyy') : '']].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                  <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                  <p style={{ fontWeight: '600', color: '#0f172a', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* L1 Remote Support */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#3b82f6', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>L1 Remote Support</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '10px' }}>
              {[['Staff', report.l1_attended_staff_name], ['Staff ID', report.l1_attended_staff_id], ['Email', report.l1_attended_staff_email], ['Date', report.l1_date], ['Report ID', report.running_number], ['L1 Status', report.l1_status ? report.l1_status.charAt(0).toUpperCase() + report.l1_status.slice(1) : '']].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: '#eff6ff', borderRadius: '6px', borderLeft: '3px solid #60a5fa' }}>
                  <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                  <p style={{ fontWeight: '600', color: '#1e40af', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
            {(report.l1_affected_items || []).length > 0 && (
              <div>
                <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Affected Items</p>
                {report.l1_affected_items.map((item, i) => (
                  <div key={i} style={{ marginBottom: '5px', padding: '8px 12px', background: '#dbeafe', borderRadius: '6px', fontSize: '11px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: '#1d4ed8', background: '#bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', flexShrink: 0 }}>{item.device_type}</span>
                    <span style={{ fontWeight: '600', color: '#1e3a8a' }}>{item.device_name}</span>
                    <span style={{ color: '#374151' }}>{item.issue_description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PAGE 2 — L2 Onsite Support — uses LOCAL state so unsaved edits & photos appear */}
        {isL2Stage && (
          <div id="pdf-page-2" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#10b981', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>L2 Onsite Support — Job Details</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '12px' }}>
              {[['Staff', l2Form.l2_attended_staff_name], ['Staff ID', l2Form.l2_attended_staff_id], ['Email', l2Form.l2_attended_staff_email], ['Attend Date', l2Form.l2_attend_date], ['Attend Time', l2Form.l2_attend_time], ['Work Order', l2Form.l2_work_order_number], ['Approver', l2Form.l2_approver_name], ['Approver Email', l2Form.l2_approver_email], ['Approved Date', report.approved_date]].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: '#ecfdf5', borderRadius: '6px', borderLeft: '3px solid #34d399' }}>
                  <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                  <p style={{ fontWeight: '600', color: '#065f46', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
            {l2Form.l2_job_description && (
              <div style={{ marginBottom: '8px', padding: '12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Job Description / Work Detail</p>
                <p style={{ fontSize: '11px', color: '#0f172a', margin: 0, lineHeight: '1.5' }}>{l2Form.l2_job_description}</p>
              </div>
            )}
            {l2Form.l2_remarks && (
              <div style={{ padding: '12px', background: '#fefce8', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Remarks</p>
                <p style={{ fontSize: '11px', color: '#0f172a', margin: 0 }}>{l2Form.l2_remarks}</p>
              </div>
            )}

            {/* L2 Items Rectification — use local l2Items state */}
            {l2Items.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '4px', height: '16px', background: '#3b82f6', borderRadius: '2px' }} />
                  <h4 style={{ fontSize: '11px', fontWeight: '700', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>L1 Items — Onsite Rectification</h4>
                </div>
                {l2Items.map((item, i) => (
                  <div key={i} style={{ marginBottom: '12px', padding: '12px', border: '1px solid #bfdbfe', borderRadius: '6px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', flexShrink: 0 }}>{item.device_type}</span>
                      <span style={{ fontWeight: '600', fontSize: '11px' }}>{item.device_name}</span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{item.issue_description}</span>
                    </div>
                    {item.rectification_steps && <p style={{ fontSize: '11px', color: '#374151', margin: '0 0 8px', paddingLeft: '4px' }}><strong>Rectification:</strong> {item.rectification_steps}</p>}
                    {(item.photos || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {item.photos.map((url, pi) => (
                          <img key={pi} src={url} alt={`photo-${pi}`} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '6px', border: '2px solid #bfdbfe' }} crossOrigin="anonymous" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add-on Items — use local l2Addons state */}
            {l2Addons.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '4px', height: '16px', background: '#a855f7', borderRadius: '2px' }} />
                  <h4 style={{ fontSize: '11px', fontWeight: '700', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Add-On Items (Onsite)</h4>
                </div>
                {l2Addons.map((item, i) => (
                  <div key={i} style={{ marginBottom: '10px', padding: '12px', border: '1px solid #e9d5ff', borderRadius: '6px', background: '#faf5ff' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: '#6b21a8', background: '#e9d5ff', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', flexShrink: 0 }}>{item.device_type}</span>
                      <span style={{ fontWeight: '600', fontSize: '11px' }}>{item.device_name}</span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{item.issue_description}</span>
                    </div>
                    {(item.photos || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {item.photos.map((url, pi) => (
                          <img key={pi} src={url} alt={`addon-${pi}`} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '6px', border: '2px solid #e9d5ff' }} crossOrigin="anonymous" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Replacements — use local replacements state */}
            {replacements.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '4px', height: '16px', background: '#f59e0b', borderRadius: '2px' }} />
                  <h4 style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Replacement Items</h4>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#fef3c7' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#92400e', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Item</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#92400e', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Old (S/N / Model)</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', color: '#92400e', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>New (S/N / Model)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replacements.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fffbeb' : '#ffffff', borderBottom: '1px solid #fde68a' }}>
                        <td style={{ padding: '7px 10px', fontWeight: '600' }}>{r.item_description}</td>
                        <td style={{ padding: '7px 10px', color: '#dc2626' }}>{r.old_item_detail}</td>
                        <td style={{ padding: '7px 10px', color: '#16a34a' }}>{r.new_item_detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PAGE 3 — Supporting Documents (only rendered if there are docs) */}
        {supportingDocs.length > 0 && (
          <div id="pdf-page-3" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ width: '4px', height: '16px', background: '#06b6d4', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#164e63', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Supporting Documents</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {supportingDocs.map((url, i) => {
                const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return isImage ? (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px', background: '#ecfeff', borderRadius: '6px', border: '1px solid #a5f3fc' }}>
                    <img src={url} alt={`doc-${i+1}`} style={{ width: '150px', height: '120px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #67e8f9', flexShrink: 0 }} crossOrigin="anonymous" />
                    <div>
                      <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Document {i + 1}</p>
                      <p style={{ fontSize: '10px', color: '#0891b2', margin: '0 0 4px', wordBreak: 'break-all' }}>{url}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ padding: '10px 14px', background: '#ecfeff', borderRadius: '6px', border: '1px solid #a5f3fc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>📎</span>
                    <div>
                      <p style={{ fontSize: '9px', color: '#64748b', margin: '0 0 2px' }}>Document {i + 1}</p>
                      <p style={{ fontSize: '10px', color: '#0891b2', wordBreak: 'break-all', margin: 0 }}>{url}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PAGE 4 — Acknowledgement */}
        <div id="pdf-page-4" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{ width: '4px', height: '16px', background: '#f59e0b', borderRadius: '2px' }} />
            <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Site Acknowledgement</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '16px' }}>
            {[['PIC Name', ackName || report.ack_name], ['Phone', ackPhone || report.ack_phone], ['Timestamp', report.ack_timestamp ? format(new Date(report.ack_timestamp), 'dd MMM yyyy HH:mm') : '']].map(([k, v]) => (
              <div key={k} style={{ padding: '8px 10px', background: '#fef3c7', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
                <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                <p style={{ fontWeight: '600', color: '#92400e', margin: 0 }}>{v || '—'}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
              <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Signature</p>
              {(signature || report.ack_signature) ? (
                <img src={signature || report.ack_signature} alt="signature" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px' }} crossOrigin="anonymous" />
              ) : (
                <div style={{ height: '80px', background: '#f8fafc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px' }}>No signature</div>
              )}
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
              <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Company Stamp</p>
              {(companyStamp || report.ack_company_stamp) ? (
                <img src={companyStamp || report.ack_company_stamp} alt="company stamp" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '4px' }} crossOrigin="anonymous" />
              ) : (
                <div style={{ height: '80px', background: '#f8fafc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px' }}>No stamp</div>
              )}
            </div>
          </div>
          {/* Footer */}
          <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
            <span>Click IX Sdn Bhd · Service Report System</span>
            <span>{report.running_number} · {format(new Date(), 'dd MMM yyyy')}</span>
          </div>
        </div>

      </div>
    </div>
  );
}