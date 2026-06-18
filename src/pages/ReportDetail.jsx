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

  const selectedStaffIds = l2Form.l2_attended_staff_ids ? l2Form.l2_attended_staff_ids.split(',').filter(Boolean) : (l2Form.l2_attended_staff_name ? [] : []);

  const handleStaffToggle = (staffId) => {
    const current = l2Form.l2_attended_staff_ids ? l2Form.l2_attended_staff_ids.split(',').filter(Boolean) : [];
    const next = current.includes(staffId) ? current.filter(id => id !== staffId) : [...current, staffId];
    const selected = l2Staff.filter(s => next.includes(s.id));
    setL2Form(f => ({
      ...f,
      l2_attended_staff_ids: next.join(','),
      l2_attended_staff_name: selected.map(s => s.name).join(', '),
      l2_attended_staff_id: selected.map(s => s.staff_id).join(', '),
      l2_attended_staff_email: selected.map(s => s.email || '').join(', '),
    }));
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

    // Collect all image URLs that need to be pre-loaded
    const allImageUrls = [
      ...l2Items.flatMap(item => item.photos || []),
      ...l2Addons.flatMap(item => item.photos || []),
      ...supportingDocs.filter(url => url.match(/\.(jpg|jpeg|png|gif|webp)$/i)),
      ...(signature ? [signature] : []),
      ...(companyStamp ? [companyStamp] : []),
    ];

    // Pre-load all images to ensure they are in browser cache before html2canvas runs
    await Promise.all(allImageUrls.map(url => new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = resolve;
      img.onerror = resolve; // don't block on failed images
      img.src = url + (url.includes('?') ? '&' : '?') + '_nocache=' + Date.now();
    })));

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const wrapper = document.getElementById('pdf-print-area');
    wrapper.style.display = 'block';

    // Small delay to allow DOM to fully render images
    await new Promise(r => setTimeout(r, 500));

    const hasDocs = supportingDocs.length > 0;
    const pageIds = ['pdf-page-1', 'pdf-page-2', ...(hasDocs ? ['pdf-page-3'] : []), 'pdf-page-4'];
    let isFirstPage = true;
    for (const pageId of pageIds) {
      const el = document.getElementById(pageId);
      if (!el || el.offsetHeight < 5) continue;
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 794,
        logging: false,
      });
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
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-2">
              <Edit2 size={14} /> Edit
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-2">
                <X size={14} /> Cancel
              </Button>
              <Button size="sm" onClick={saveL2} className="gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={updateReport.isPending}>
                <Save size={14} /> {updateReport.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
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
            {/* Save Draft for non-complete statuses */}
            {report.status !== 'complete' && (
              <Button variant="outline" size="sm" onClick={saveL2} disabled={updateReport.isPending}>
                <Save size={14} className="mr-2" /> {updateReport.isPending ? 'Saving...' : 'Save Draft'}
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
            <ReadField label="DO Number" value={report.do_number} />
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
                  {isReadOnly ? (
                    <div className="text-sm py-1">{l2Form.l2_attended_staff_name || '—'}</div>
                  ) : (
                    <div className="border border-input rounded-md bg-background p-2 space-y-1 max-h-36 overflow-y-auto">
                      {l2Staff.length === 0 && <p className="text-xs text-muted-foreground">No L2 staff found</p>}
                      {l2Staff.map(s => {
                        const checked = (l2Form.l2_attended_staff_ids || '').split(',').filter(Boolean).includes(s.id) ||
                          (!l2Form.l2_attended_staff_ids && l2Form.l2_attended_staff_name?.includes(s.name));
                        return (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                            <input type="checkbox" checked={checked} onChange={() => handleStaffToggle(s.id)} className="accent-primary" />
                            <span className="text-sm">{s.name}</span>
                            {s.staff_id && <span className="text-xs text-muted-foreground font-mono">({s.staff_id})</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
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
      <div id="pdf-print-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, fontFamily: 'Arial, sans-serif', color: '#111827' }}>

        {/* Shared header/footer helpers as inline styles */}
        {/* PAGE 1 — Header + Job Info + L1 */}
        <div id="pdf-page-1" style={{ width: '794px', background: 'white' }}>
          {/* Blue header */}
          <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' }}>CLICK IX SDN BHD</div>
              <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>SERVICE REPORT</div>
              <div style={{ fontSize: '10px', color: '#bfdbfe', marginTop: '2px', fontFamily: 'monospace' }}>{report.running_number}</div>
            </div>
            <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>
              Generated: {format(new Date(), 'dd/MM/yyyy, HH:mm:ss')}
            </div>
          </div>

          <div style={{ padding: '24px 32px 32px' }}>
            {/* Job Information */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Job Information</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                {[['TECHNICIAN', report.l1_attended_staff_name], ['TECHNICIAN EMAIL', report.l1_attended_staff_email], ['STORE', report.site_name], ['LOCATION', report.site_location], ['WORK ORDER NUMBER', report.do_number], ['APPROVED BY', report.l2_approver_name], ['CLIENT', report.client_name], ['CLIENT EMAIL', report.admin_email]].filter(([,v]) => v).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: '2px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* L1 Remote Support */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>1st Level Support (Remote)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                {[['L1 REPORT NUMBER', report.running_number], ['REMOTELY ATTENDED BY', report.l1_attended_staff_name], ['ATTENDED ON', report.l1_date ? `${report.l1_date} at ${report.l1_attended_staff_id || ''}` : ''], ['L1 STATUS', report.l1_status ? report.l1_status.charAt(0).toUpperCase() + report.l1_status.slice(1) : '']].filter(([,v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                  </div>
                ))}
              </div>
              {report.l1_remarks && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>ISSUES IDENTIFIED</div>
                  <div style={{ fontSize: '12px', color: '#111827' }}>{report.l1_remarks}</div>
                </div>
              )}
              {(report.l1_affected_items || []).length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>AFFECTED HARDWARE</div>
                  {report.l1_affected_items.map((item, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#111827', marginBottom: '4px' }}>
                      {item.device_type} — {item.device_name}{item.issue_description ? `: ${item.issue_description}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2nd Level Support header */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>2nd Level Support (Onsite)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                {[['SERVICE TYPE', l2Form.l2_job_description?.split('.')[0]], ['STATUS', report.status ? report.status.charAt(0).toUpperCase() + report.status.slice(1) : ''], ['DATE', l2Form.l2_attend_date], ['TIME', l2Form.l2_attend_time ? `${l2Form.l2_attend_time} – ${l2Form.l2_attend_time}` : '']].filter(([,v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
            <span>Page 1 of {isL2Stage ? (supportingDocs.length > 0 ? '4' : '3') : '2'} | ServiceDesk Report</span>
            <span>{report.running_number}</span>
          </div>
        </div>

        {/* PAGE 2 — L2 Onsite Support Work Details */}
        {isL2Stage && (
          <div id="pdf-page-2" style={{ width: '794px', background: 'white' }}>
            <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>CLICK IX SDN BHD</div>
                <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>SERVICE REPORT</div>
              </div>
              <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>{report.running_number}</div>
            </div>

            <div style={{ padding: '24px 32px 32px' }}>
              {/* Work Details */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Work Details</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: '12px' }}>
                  {[['TECHNICIAN', l2Form.l2_attended_staff_name], ['TECHNICIAN ID', l2Form.l2_attended_staff_id], ['WORK ORDER', l2Form.l2_work_order_number], ['SITE PIC', l2Form.l2_site_pic_name]].filter(([,v]) => v).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                      <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {l2Form.l2_job_description && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>JOB DESCRIPTION</div>
                    <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.6' }}>{l2Form.l2_job_description}</div>
                  </div>
                )}
                {l2Form.l2_work_detail && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>WORK PERFORMED</div>
                    <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.6' }}>{l2Form.l2_work_detail}</div>
                  </div>
                )}
                {l2Form.l2_remarks && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>REMARKS</div>
                    <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.6' }}>{l2Form.l2_remarks}</div>
                  </div>
                )}
              </div>

              {/* Affected Devices */}
              {l2Items.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Affected Devices</span>
                  </div>
                  {l2Items.map((item, i) => (
                    <div key={i} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '2px' }}>DEVICE {i + 1}</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827', marginBottom: '6px' }}>{item.device_type} — {item.device_name}</div>
                      {item.issue_description && (
                        <div style={{ marginBottom: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>ISSUE: </span>
                          <span style={{ fontSize: '12px', color: '#111827' }}>{item.issue_description}</span>
                        </div>
                      )}
                      {item.rectification_steps && (
                        <div style={{ marginBottom: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>RECTIFICATION: </span>
                          <span style={{ fontSize: '12px', color: '#111827' }}>{item.rectification_steps}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Issue & Rectification */}
              {l2Items.some(i => i.photos?.length > 0) && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Photo Evidence</span>
                  </div>
                  {l2Items.map((item, i) => item.photos?.length > 0 && (
                    <div key={i} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>#{i + 1} {item.device_name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {item.photos.map((url, pi) => (
                          <img key={pi} src={url} alt="" crossOrigin="anonymous" style={{ width: '300px', height: '300px', objectFit: 'cover', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add-on items */}
              {l2Addons.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Add-On Items (Onsite)</span>
                  </div>
                  {l2Addons.map((item, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827' }}>{item.device_type} — {item.device_name}</div>
                      {item.issue_description && <div style={{ fontSize: '12px', color: '#374151' }}>{item.issue_description}</div>}
                      {item.photos?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                          {item.photos.map((url, pi) => (
                            <img key={pi} src={url} alt="" crossOrigin="anonymous" style={{ width: '300px', height: '300px', objectFit: 'cover', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Replacements */}
              {replacements.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Replacement Items</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ padding: '7px 10px', textAlign: 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb' }}>Item</th>
                        <th style={{ padding: '7px 10px', textAlign: 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb' }}>Old (S/N / Model)</th>
                        <th style={{ padding: '7px 10px', textAlign: 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb' }}>New (S/N / Model)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {replacements.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{r.item_description}</td>
                          <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{r.old_item_detail}</td>
                          <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{r.new_item_detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Attached Documents */}
              {supportingDocs.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Attached Documents</span>
                  </div>
                  {supportingDocs.map((url, i) => {
                    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    const fileName = url.split('/').pop() || `Document ${i + 1}`;
                    return isImage ? (
                      <div key={i} style={{ marginBottom: '8px' }}>
                        <img src={url} alt="" crossOrigin="anonymous" style={{ width: '300px', height: '240px', objectFit: 'cover', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                      </div>
                    ) : (
                      <div key={i} style={{ fontSize: '12px', color: '#2563eb', marginBottom: '4px' }}>📎 {fileName}</div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
              <span>Page 2 of {supportingDocs.length > 0 ? '4' : '3'} | ServiceDesk Report</span>
              <span>{report.running_number}</span>
            </div>
          </div>
        )}

        {/* PAGE 3 — Supporting Documents images (only if image docs) */}
        {supportingDocs.filter(u => u.match(/\.(jpg|jpeg|png|gif|webp)$/i)).length > 0 && (
          <div id="pdf-page-3" style={{ width: '794px', background: 'white' }}>
            <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>CLICK IX SDN BHD</div>
                <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>SERVICE REPORT</div>
              </div>
              <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>{report.running_number}</div>
            </div>
            <div style={{ padding: '24px 32px 32px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Supporting Photos</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {supportingDocs.filter(u => u.match(/\.(jpg|jpeg|png|gif|webp)$/i)).map((url, i) => (
                  <img key={i} src={url} alt="" crossOrigin="anonymous" style={{ width: '300px', height: '240px', objectFit: 'cover', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                ))}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
              <span>Page 3 of 4 | ServiceDesk Report</span>
              <span>{report.running_number}</span>
            </div>
          </div>
        )}

        {/* PAGE 4 — Acknowledgement / Client Signature */}
        <div id="pdf-page-4" style={{ width: '794px', background: 'white' }}>
          <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>CLICK IX SDN BHD</div>
              <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>SERVICE REPORT</div>
            </div>
            <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>{report.running_number}</div>
          </div>

          <div style={{ padding: '24px 32px 32px' }}>
            <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Client Signature</span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              {(signature || report.ack_signature) ? (
                <img src={signature || report.ack_signature} alt="signature" crossOrigin="anonymous" style={{ maxWidth: '220px', maxHeight: '120px', display: 'block', marginBottom: '12px' }} />
              ) : (
                <div style={{ width: '220px', height: '80px', border: '1px solid #e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '11px', marginBottom: '12px' }}>No signature</div>
              )}
              <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Name:</strong> {ackName || report.ack_name || '—'}</div>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Phone:</strong> {ackPhone || report.ack_phone || '—'}</div>
              {report.ack_timestamp && <div style={{ fontSize: '12px', color: '#6b7280' }}>Signed on: {format(new Date(report.ack_timestamp), 'dd/MM/yyyy, HH:mm:ss')}</div>}
            </div>
            {(companyStamp || report.ack_company_stamp) && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>COMPANY STAMP</div>
                <img src={companyStamp || report.ack_company_stamp} alt="stamp" crossOrigin="anonymous" style={{ maxWidth: '200px', maxHeight: '120px', objectFit: 'contain' }} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
            <span>Page {isL2Stage ? (supportingDocs.filter(u => u.match(/\.(jpg|jpeg|png|gif|webp)$/i)).length > 0 ? '4' : '3') : '2'} of {isL2Stage ? (supportingDocs.filter(u => u.match(/\.(jpg|jpeg|png|gif|webp)$/i)).length > 0 ? '4' : '3') : '2'} | ServiceDesk Report</span>
            <span>{report.running_number}</span>
          </div>
        </div>

      </div>
    </div>
  );
}