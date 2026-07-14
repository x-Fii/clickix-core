import { useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Save, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CATEGORIES = ['Hardware', 'Software', 'Networking', 'Cabling', 'Consumables', 'Services', 'Other'];
const PAYMENT_TERMS = ['30 Days', '60 Days', '90 Days', 'COD', 'Advance Payment', 'Upon Delivery'];
const CLAIM_TYPES = ['Reimbursement', 'Vendor Payment', 'Contractor Payment', 'Internal Expense', 'Other'];

const Field = ({ label, children }) =>
<div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</Label>
    {children}
  </div>;


const genClaimNumber = () => `CF${format(new Date(), 'yy')}-${String(Math.floor(Math.random() * 9000 + 1000))}`;

const STATUS_COLORS = {
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  submitted: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
  paid: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/25'
};

export default function ClaimForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    claim_number: genClaimNumber(),
    claim_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'draft',
    pr_id: '',
    pr_number: '',
    quotation_id: '',
    quotation_number: '',
    sr_id: '',
    sr_number: '',
    sr_ids: [],
    sr_numbers: [],
    ir_id: '',
    ir_number: '',
    ir_ids: [],
    ir_numbers: [],
    client_name: '',
    site_name: '',
    site_names: [],
    claimant_name: '',
    claimant_department: '',
    claimant_email: '',
    claimant_phone: '',
    claim_type: '',
    payment_term: '',
    purpose: '',
    approved_by: '',
    approved_date: '',
    paid_date: '',
    payment_reference: '',
    remarks: ''
  });
  const [items, setItems] = useState([
  { item_no: 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }]
  );
  const [offDayClaims, setOffDayClaims] = useState([
  { work_date: '', work_type: '', unit: 'Hours', claimed: 0, replacement_date: '', replacement: 0 }]
  );
  const loadedRef = useRef(false);
  const prPrefillRef = useRef(false);


  // Load existing claim
  useQuery({
    queryKey: ['claim', id],
    queryFn: async () => {
      const c = await base44.entities.Claim.get(id);
      if (loadedRef.current) return c;
      loadedRef.current = true;
      setForm({
        ...c,
        sr_ids: Array.isArray(c.sr_ids) ? c.sr_ids : (c.sr_id ? [c.sr_id] : []),
        sr_numbers: Array.isArray(c.sr_numbers) ? c.sr_numbers : (c.sr_number ? [c.sr_number] : []),
        ir_ids: Array.isArray(c.ir_ids) ? c.ir_ids : (c.ir_id ? [c.ir_id] : []),
        ir_numbers: Array.isArray(c.ir_numbers) ? c.ir_numbers : (c.ir_number ? [c.ir_number] : []),
        site_names: Array.isArray(c.site_names) ? c.site_names : (c.site_name ? [c.site_name] : []),
      });
      setItems(c.items?.length ? c.items : [{ item_no: 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }]);
      setOffDayClaims(c.off_day_claims?.length ? c.off_day_claims : [{ work_date: '', work_type: '', unit: 'Hours', claimed: 0, replacement_date: '', replacement: 0 }]);
      return c;
    },
    enabled: isEdit
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.StaffMember.list()
  });

  const { data: prs = [] } = useQuery({
    queryKey: ['purchase-requisitions'],
    queryFn: () => base44.entities.PurchaseRequisition.list('-created_date', 100)
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 100)
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 100)
  });

  const { data: installationReports = [] } = useQuery({
    queryKey: ['installation-reports'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 100)
  });

  // Auto-load from PR if ?from_pr=id query param
  const fromPrId = searchParams.get('from_pr');
  useQuery({
    queryKey: ['pr-prefill', fromPrId],
    queryFn: async () => {
      const pr = await base44.entities.PurchaseRequisition.get(fromPrId);
      if (prPrefillRef.current) return pr;
      prPrefillRef.current = true;
      setForm((f) => ({
        ...f,
        pr_id: pr.id,
        pr_number: pr.pr_number,
        quotation_id: pr.quotation_id || '',
        quotation_number: pr.quotation_number || '',
        sr_id: pr.sr_id || '',
        sr_number: pr.sr_number || '',
        sr_ids: pr.sr_id ? [pr.sr_id] : [],
        sr_numbers: pr.sr_number ? [pr.sr_number] : [],
        ir_id: pr.ir_id || '',
        ir_number: pr.ir_number || '',
        ir_ids: pr.ir_id ? [pr.ir_id] : [],
        ir_numbers: pr.ir_number ? [pr.ir_number] : [],
        client_name: pr.client_name || '',
        site_name: pr.site_name || '',
        site_names: pr.site_name ? [pr.site_name] : [],
        claimant_name: pr.requester_name || '',
        claimant_department: pr.requester_department || '',
        claimant_email: pr.requester_email || '',
        claimant_phone: pr.requester_phone || '',
        payment_term: pr.payment_term || '',
        purpose: pr.purpose_of_purchase || '',
        approved_by: pr.approved_by || ''
      }));
      if (pr.items?.length) {
        setItems(pr.items.map((it, i) => ({
          item_no: i + 1,
          description: it.description || '',
          category: it.category || '',
          quantity: it.quantity || 1,
          unit_cost: it.unit_cost || 0,
          total: it.total || (it.quantity || 1) * (it.unit_cost || 0)
        })));
      }
      return pr;
    },
    enabled: !!fromPrId && !isEdit
  });

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ?
    base44.entities.Claim.update(id, data) :
    base44.entities.Claim.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      toast.success(isEdit ? 'Claim updated' : 'Claim created');
      navigate('/claims');
    }
  });

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePRSelect = (prId) => {
    const pr = prs.find((x) => x.id === prId);
    if (pr) {
      setForm((f) => ({
        ...f,
        pr_id: pr.id,
        pr_number: pr.pr_number,
        quotation_id: pr.quotation_id || '',
        quotation_number: pr.quotation_number || '',
        sr_id: pr.sr_id || '',
        sr_number: pr.sr_number || '',
        sr_ids: pr.sr_id ? [pr.sr_id] : [],
        sr_numbers: pr.sr_number ? [pr.sr_number] : [],
        ir_id: pr.ir_id || '',
        ir_number: pr.ir_number || '',
        ir_ids: pr.ir_id ? [pr.ir_id] : [],
        ir_numbers: pr.ir_number ? [pr.ir_number] : [],
        client_name: pr.client_name || '',
        site_name: pr.site_name || '',
        site_names: pr.site_name ? [pr.site_name] : [],
        claimant_name: pr.requester_name || '',
        claimant_department: pr.requester_department || '',
        claimant_email: pr.requester_email || '',
        claimant_phone: pr.requester_phone || '',
        payment_term: pr.payment_term || '',
        purpose: pr.purpose_of_purchase || '',
        approved_by: pr.approved_by || ''
      }));
      if (pr.items?.length) {
        setItems(pr.items.map((it, i) => ({
          item_no: i + 1,
          description: it.description || '',
          category: it.category || '',
          quantity: it.quantity || 1,
          unit_cost: it.unit_cost || 0,
          total: it.total || (it.quantity || 1) * (it.unit_cost || 0)
        })));
        toast.success(`${pr.items.length} items imported from PR`);
      }
    }
  };

  const recomputeFromReports = (nextSrIds, nextIrIds) => {
    const selSRs = reports.filter((r) => nextSrIds.includes(r.id));
    const selIRs = installationReports.filter((r) => nextIrIds.includes(r.id));
    const allSelected = [...selSRs, ...selIRs];
    const sites = Array.from(new Set(allSelected.map((r) => r.site_name).filter(Boolean)));
    const clients = Array.from(new Set(allSelected.map((r) => r.client_name).filter(Boolean)));
    setForm((f) => ({
      ...f,
      sr_ids: nextSrIds,
      sr_numbers: selSRs.map((r) => r.running_number),
      sr_id: selSRs[0]?.id || '',
      sr_number: selSRs[0]?.running_number || '',
      ir_ids: nextIrIds,
      ir_numbers: selIRs.map((r) => r.report_number),
      ir_id: selIRs[0]?.id || '',
      ir_number: selIRs[0]?.report_number || '',
      site_names: sites,
      site_name: sites.join(', '),
      client_name: clients[0] || f.client_name,
    }));
  };

  const toggleReport = (rid, type) => {
    const cur = type === 'sr' ? form.sr_ids || [] : form.ir_ids || [];
    const next = cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid];
    if (type === 'sr') recomputeFromReports(next, form.ir_ids || []);
    else recomputeFromReports(form.sr_ids || [], next);
  };

  const updateItem = (i, field, val) => {
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === 'quantity' || field === 'unit_cost') {
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_cost) || 0);
      }
      return updated;
    }));
  };

  const addItem = () => setItems((p) => [...p, { item_no: p.length + 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }]);

  const updateOffDay = (i, field, val) => {
    setOffDayClaims((prev) => prev.map((item, idx) => idx !== i ? item : { ...item, [field]: val }));
  };

  const addOffDay = () => setOffDayClaims((p) => [...p, { work_date: '', work_type: '', unit: 'Hours', claimed: 0, replacement_date: '', replacement: 0 }]);

  const itemsTotal = items.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
  const docCount = (form.sr_ids?.length || 0) + (form.ir_ids?.length || 0);
  const averagedItemsTotal = docCount > 0 ? itemsTotal / docCount : itemsTotal;
  const siteSummary = Object.entries(
    [
      ...reports.filter((r) => (form.sr_ids || []).includes(r.id)).map((r) => r.site_name),
      ...installationReports.filter((r) => (form.ir_ids || []).includes(r.id)).map((r) => r.site_name)
    ].filter(Boolean).reduce((acc, site) => { acc[site] = (acc[site] || 0) + 1; return acc; }, {})
  ).map(([site, count]) => ({ site, count, total: averagedItemsTotal * count }));
  const offDayClaimedTotal = offDayClaims.reduce((s, it) => s + (parseFloat(it.claimed) || 0), 0);
  const offDayReplacementTotal = offDayClaims.reduce((s, it) => s + (parseFloat(it.replacement) || 0), 0);
  const grandTotal = averagedItemsTotal;

  const handleSave = (status) => {
    saveMutation.mutate({ ...form, items, off_day_claims: offDayClaims, subtotal: itemsTotal, grand_total: grandTotal, status: status || form.status });
  };

  const handleExportPDF = async () => {
    toast.info('Generating PDF...');
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    // Initialize standard A4 landscape/portrait sizing properties
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    const wrapper = document.getElementById('claim-pdf-area');
    wrapper.style.display = 'block';
    await new Promise((r) => setTimeout(r, 100));

    const el = document.getElementById('claim-pdf-content');
    // Re-applied the explicit width threshold to maintain consistent text scaling across pages
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794 });
    wrapper.style.display = 'none';

    const imgData = canvas.toDataURL('image/png');
    const imgW = pw;
    const imgH = canvas.height * imgW / canvas.width;

    let yPos = 0;
    let pageCount = 0;

    // Safely loop and distribute the image chunks down the pages
    while (yPos < imgH) {
      if (pageCount > 0) {
        pdf.addPage();
      }
      // 'FAST' memory allocation avoids canvas doubling and limits total document size
      pdf.addImage(imgData, 'PNG', 0, -yPos, imgW, imgH, undefined, 'FAST');
      yPos += ph;
      pageCount++;
    }

    pdf.save(`${form.claim_number}.pdf`);
    toast.success('PDF exported');
  };



  const handleSubmitToAdmin = async () => {
    const adminEmail = prompt('Enter admin email address:');
    if (!adminEmail) return;
    await base44.integrations.Core.SendEmail({
      to: adminEmail,
      subject: `Claim ${form.claim_number} — ${form.status?.toUpperCase()}`,
      body: `Claim Submission\n\nClaim No: ${form.claim_number}\nDate: ${form.claim_date}\nClaimant: ${form.claimant_name} (${form.claimant_department})\nType: ${form.claim_type}\nClient: ${form.client_name}\nSite: ${form.site_name}\nLinked PR: ${form.pr_number || '—'}\nSR No: ${form.sr_number || '—'}\nGrand Total: MYR ${grandTotal.toFixed(2)}\n\nPurpose: ${form.purpose}\n\nPlease log in to the system to review this claim.`
    });
    toast.success(`Claim submitted to ${adminEmail}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/claims')}><ArrowLeft size={16} className="mr-2" /> Back</Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{isEdit ? 'Edit Claim' : 'New Claim'}</h1>
              {form.status &&
              <span className={`inline-flex px-2.5 py-0.5 text-[11px] font-mono border rounded-full ${STATUS_COLORS[form.status] || STATUS_COLORS.draft}`}>
                  {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                </span>
              }
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{form.claim_number}</p>
          </div>
        </div>
        {isEdit &&
        <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2"><Download size={14} /> PDF</Button>
            <Button size="sm" onClick={handleSubmitToAdmin} className="gap-2"><Send size={14} /> Submit to Admin</Button>
          </div>
        }
      </div>



      <div className="space-y-6">
        {/* Document Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Document Header</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Claim Number"><Input value={form.claim_number} onChange={(e) => setF('claim_number', e.target.value)} className="bg-background font-mono" /></Field>
            <Field label="Claim Date"><Input type="date" value={form.claim_date} onChange={(e) => setF('claim_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Claim Type">
              {form.claim_type && !CLAIM_TYPES.includes(form.claim_type) ?
              <div className="flex gap-1">
                  <Input value={form.claim_type} onChange={(e) => setF('claim_type', e.target.value)} className="bg-background text-sm" placeholder="Enter type..." />
                  <button onClick={() => setF('claim_type', '')} className="text-muted-foreground hover:text-foreground px-1"><X size={14} /></button>
                </div> :

              <Select value={form.claim_type || undefined} onValueChange={(v) => setF('claim_type', v === 'Other' ? ' ' : v)}>
                  <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>{CLAIM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              }
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setF('status', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'submitted', 'approved', 'rejected', 'paid'].map((s) =>
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Claimant Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Claimant Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Claimant Name">
              <Select value={form.claimant_name || undefined} onValueChange={(v) => {
                const s = staff.find((m) => m.name === v);
                setForm((f) => ({ ...f, claimant_name: v, claimant_department: s?.department || f.claimant_department, claimant_email: s?.email || f.claimant_email, claimant_phone: s?.phone || f.claimant_phone }));
              }}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select staff..." /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {staff.map((s) => <SelectItem key={s.id} value={s.name}>{s.name} ({s.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Department"><Input value={form.claimant_department} onChange={(e) => setF('claimant_department', e.target.value)} className="bg-background" /></Field>
            <Field label="Email"><Input type="email" value={form.claimant_email} onChange={(e) => setF('claimant_email', e.target.value)} className="bg-background" /></Field>
            <Field label="Phone"><Input value={form.claimant_phone} onChange={(e) => setF('claimant_phone', e.target.value)} className="bg-background" /></Field>
          </div>
        </div>

        {/* Linked Documents */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Linked Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Purchase Requisition (PR)">
              <Select value={form.pr_id} onValueChange={handlePRSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select PR to convert from..." /></SelectTrigger>
                <SelectContent>{prs.map((p) => <SelectItem key={p.id} value={p.id}>{p.pr_number} — {p.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Quotation">
              <Select value={form.quotation_id} onValueChange={(v) => {
                const q = quotations.find((x) => x.id === v);
                if (!q) return;
                // chain-fill linked SR or IR from quotation
                const linkedSR = q.sr_id ? reports.find((r) => r.id === q.sr_id) : null;
                const linkedIR = q.ir_id ? installationReports.find((r) => r.id === q.ir_id) : null;
                setForm((f) => ({
                   ...f,
                   quotation_id: q.id,
                   quotation_number: q.quotation_number,
                   client_name: q.client_name || f.client_name,
                   site_name: q.site_name || f.site_name,
                   site_names: q.site_name ? [q.site_name] : f.site_names,
                   sr_id: linkedSR ? linkedSR.id : f.sr_id,
                   sr_number: linkedSR ? linkedSR.running_number : f.sr_number,
                   sr_ids: linkedSR ? [linkedSR.id] : f.sr_ids,
                   sr_numbers: linkedSR ? [linkedSR.running_number] : f.sr_numbers,
                   ir_id: linkedIR ? linkedIR.id : f.ir_id,
                   ir_number: linkedIR ? linkedIR.report_number : f.ir_number,
                   ir_ids: linkedIR ? [linkedIR.id] : f.ir_ids,
                   ir_numbers: linkedIR ? [linkedIR.report_number] : f.ir_numbers
                 }));
              }}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select quotation..." /></SelectTrigger>
                <SelectContent>{quotations.map((q) => <SelectItem key={q.id} value={q.id}>{q.quotation_number} — {q.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Service / Installation Reports">
              <div className="rounded-md border border-input bg-background p-2 space-y-2">
                {(form.sr_ids?.length > 0 || form.ir_ids?.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(form.sr_ids || []).map((rid) => {
                      const r = reports.find((x) => x.id === rid);
                      if (!r) return null;
                      return (
                        <span key={rid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-primary/15 text-primary border border-primary/25">
                          SR: {r.running_number}
                          <button type="button" onClick={() => toggleReport(rid, 'sr')} className="hover:text-destructive"><X size={11} /></button>
                        </span>
                      );
                    })}
                    {(form.ir_ids || []).map((rid) => {
                      const r = installationReports.find((x) => x.id === rid);
                      if (!r) return null;
                      return (
                        <span key={rid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-orange-500/15 text-orange-400 border border-orange-500/25">
                          IR: {r.report_number}
                          <button type="button" onClick={() => toggleReport(rid, 'ir')} className="hover:text-destructive"><X size={11} /></button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50">No reports selected</p>
                )}
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => { const v = e.target.value; if (v) toggleReport(v, 'sr'); e.target.value = ''; }}
                    className="text-xs bg-transparent border border-border rounded-md px-2 py-1 text-muted-foreground outline-none cursor-pointer flex-1 min-w-[120px]">
                    <option value="">+ Add Service Report</option>
                    {reports.map((r) => <option key={r.id} value={r.id} disabled={(form.sr_ids || []).includes(r.id)}>{r.running_number} — {r.site_name}</option>)}
                  </select>
                  <select
                    value=""
                    onChange={(e) => { const v = e.target.value; if (v) toggleReport(v, 'ir'); e.target.value = ''; }}
                    className="text-xs bg-transparent border border-border rounded-md px-2 py-1 text-muted-foreground outline-none cursor-pointer flex-1 min-w-[120px]">
                    <option value="">+ Add Installation Report</option>
                    {installationReports.map((r) => <option key={r.id} value={r.id} disabled={(form.ir_ids || []).includes(r.id)}>{r.report_number} — {r.site_name}</option>)}
                  </select>
                </div>
              </div>
            </Field>
            <Field label="Client"><Input value={form.client_name} onChange={(e) => setF('client_name', e.target.value)} className="bg-background" placeholder="Auto-filled" /></Field>
            <Field label="Site"><Input value={form.site_name} onChange={(e) => setF('site_name', e.target.value)} className="bg-background" placeholder="Auto-filled" /></Field>
            <Field label="Payment Term">
              <Select value={form.payment_term} onValueChange={(v) => setF('payment_term', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{PAYMENT_TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Purpose / Justification">
              <Textarea value={form.purpose} onChange={(e) => setF('purpose', e.target.value)} className="bg-background resize-none" rows={2} placeholder="Describe the purpose of this claim..." />
            </Field>
          </div>
        </div>

        {/* Items */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-border">
            <div>
              <h3 className="font-semibold text-sm">Claim Items</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {docCount > 0
                  ? <>Averaged across <span className="text-primary font-medium">{docCount}</span> document{docCount > 1 ? 's' : ''}: {[...(form.sr_numbers || []), ...(form.ir_numbers || [])].join(', ')}</>
                  : 'Items being claimed (can differ from PR)'}
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addItem}><Plus size={12} /> Add Item</Button>
          </div>
          {docCount > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(form.sr_numbers || []).map((n, idx) => (
                <span key={`sr-${idx}`} className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-2 py-0.5 font-mono">SR · {n}</span>
              ))}
              {(form.ir_numbers || []).map((n, idx) => (
                <span key={`ir-${idx}`} className="inline-flex items-center gap-1 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-2 py-0.5 font-mono">IR · {n}</span>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-center pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-10 pr-2">#</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider pr-2">Description</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-32 pr-2">Category</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-20 pr-2">Qty</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-28 pr-2">Unit Cost</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-28 pr-2">Total</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-28">Avg Total{docCount > 1 ? ` /${docCount}` : ''}</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, i) =>
                <tr key={i}>
                    <td className="py-2 pr-2 text-center text-xs text-muted-foreground font-mono">{i + 1}</td>
                    <td className="py-2 pr-2"><Input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="bg-background text-xs h-8" placeholder="Item description" /></td>
                    <td className="py-2 pr-2">
                      <Select value={item.category} onValueChange={(v) => updateItem(i, 'category', v)}>
                        <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-2"><Input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="bg-background text-xs h-8 text-right" min="1" /></td>
                    <td className="py-2 pr-2"><Input type="number" value={item.unit_cost} onChange={(e) => updateItem(i, 'unit_cost', e.target.value)} className="bg-background text-xs h-8 text-right" min="0" step="0.01" /></td>
                    <td className="py-2 pr-2 text-right font-mono text-xs">{(item.total || 0).toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-xs text-primary">{(docCount > 0 ? (item.total || 0) / docCount : (item.total || 0)).toFixed(2)}</td>
                    <td className="py-2 pl-2">
                      <button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-border pt-4 flex justify-end">
            <div className="space-y-1 min-w-60">
              {docCount > 1 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Items Total (raw)</span>
                  <span className="font-mono">MYR {itemsTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-sm">
                <span>Items Total{docCount > 1 ? ` (avg / ${docCount} docs)` : ''}</span>
                <span className="font-mono text-primary">MYR {averagedItemsTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {siteSummary.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Total per Site</h4>
              <div className="space-y-1.5">
                {siteSummary.map((s) => (
                  <div key={s.site} className="flex items-center justify-between text-sm bg-secondary/40 rounded px-3 py-1.5">
                    <span className="truncate pr-2">{s.site} <span className="text-xs text-muted-foreground">({s.count} doc{s.count > 1 ? 's' : ''})</span></span>
                    <span className="font-mono text-primary whitespace-nowrap">MYR {s.total.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between font-semibold text-sm pt-1.5 border-t border-border">
                  <span>Total</span>
                  <span className="font-mono text-primary">MYR {siteSummary.reduce((s, x) => s + x.total, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Off Day & Hours Claims */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-border">
            <div>
              <h3 className="font-semibold text-sm">Off Day & Hours Claims</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Claim hours/days worked on weekends or public holidays, offset by replacement time off</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addOffDay}><Plus size={12} /> Add Row</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider pr-2">Work Date</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider pr-2">Work Type</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-24 pr-2">Unit</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-20 pr-2">Claimed</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider pr-2">Replacement Date</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-20">Replacement</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {offDayClaims.map((item, i) =>
                <tr key={i}>
                    <td className="py-2 pr-2"><Input type="date" value={item.work_date} onChange={(e) => updateOffDay(i, 'work_date', e.target.value)} className="text-xs h-8 bg-[hsl(var(--popover))] opacity-100" /></td>
                    <td className="py-2 pr-2">
                      <Select value={item.work_type || undefined} onValueChange={(v) => updateOffDay(i, 'work_type', v)}>
                        <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Installation">Installation</SelectItem>
                          <SelectItem value="Attended Maintenance">Attended Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-2">
                      <Select value={item.unit || 'Hours'} onValueChange={(v) => updateOffDay(i, 'unit', v)}>
                        <SelectTrigger className="bg-background text-xs h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Hours">Hours</SelectItem>
                          <SelectItem value="Days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-2"><Input type="number" value={item.claimed} onChange={(e) => updateOffDay(i, 'claimed', e.target.value)} className="bg-background text-xs h-8 text-right" min="0" step="0.5" /></td>
                    <td className="py-2 pr-2"><Input type="date" value={item.replacement_date} onChange={(e) => updateOffDay(i, 'replacement_date', e.target.value)} className="bg-background text-xs h-8" /></td>
                    <td className="py-2"><Input type="number" value={item.replacement} onChange={(e) => updateOffDay(i, 'replacement', e.target.value)} className="bg-background text-xs h-8 text-right" min="0" step="0.5" /></td>
                    <td className="py-2 pl-2">
                      <button onClick={() => setOffDayClaims((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-border pt-4 flex justify-end gap-6">
            <div className="flex justify-between font-semibold min-w-48 text-sm">
              <span>Total Claimed</span>
              <span className="font-mono text-primary">{offDayClaimedTotal}</span>
            </div>
            <div className="flex justify-between font-semibold min-w-48 text-sm">
              <span>Total Replacement</span>
              <span className="font-mono text-primary">{offDayReplacementTotal}</span>
            </div>
          </div>
        </div>

        {/* Grand Total Summary */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex justify-end">
            <div className="min-w-60 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items Total{docCount > 1 ? ` (avg)` : ''}</span>
                <span className="font-mono">MYR {averagedItemsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Off Day Claimed</span>
                <span className="font-mono">{offDayClaimedTotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Off Day Replacement</span>
                <span className="font-mono">{offDayReplacementTotal}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span>Grand Total</span>
                <span className="font-mono text-primary">MYR {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Approval & Payment */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Approval & Payment</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Approved By"><Input value={form.approved_by} onChange={(e) => setF('approved_by', e.target.value)} className="bg-background" /></Field>
            <Field label="Approved Date"><Input type="date" value={form.approved_date} onChange={(e) => setF('approved_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Paid Date"><Input type="date" value={form.paid_date} onChange={(e) => setF('paid_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Payment Reference"><Input value={form.payment_reference} onChange={(e) => setF('payment_reference', e.target.value)} className="bg-background font-mono" placeholder="e.g. CHQ-001, TT ref" /></Field>
            <div className="md:col-span-2">
              <Field label="Remarks">
                <Textarea value={form.remarks} onChange={(e) => setF('remarks', e.target.value)} className="bg-background resize-none" rows={2} placeholder="Additional notes..." />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate('/claims')}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={saveMutation.isPending}><Save size={14} className="mr-2" /> Save Draft</Button>
          <Button onClick={() => handleSave('submitted')} disabled={saveMutation.isPending}>Submit Claim</Button>
        </div>
      </div>

      {/* Hidden PDF Template */}
      <div id="claim-pdf-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, fontFamily: 'Arial, sans-serif', color: '#111827' }}>
        <div id="claim-pdf-content" style={{ width: '794px', background: 'white' }}>
          {/* Blue Header */}
          <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' }}>CLICK IX SDN BHD</div>
              <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>CLAIM DOCUMENT</div>
              <div style={{ fontSize: '10px', color: '#bfdbfe', marginTop: '2px', fontFamily: 'monospace' }}>{form.claim_number}</div>
            </div>
            <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>
              Generated: {format(new Date(), 'dd/MM/yyyy, HH:mm:ss')}
            </div>
          </div>

          <div style={{ padding: '24px 32px 32px' }}>
            {/* Document Info */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Document Info</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['CLAIM NUMBER', form.claim_number], ['CLAIM DATE', form.claim_date], ['CLAIM TYPE', form.claim_type], ['STATUS', (form.status || '').toUpperCase()]].map(([k, v]) =>
                <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Claimant */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Claimant Details</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['NAME', form.claimant_name], ['DEPARTMENT', form.claimant_department], ['EMAIL', form.claimant_email], ['PHONE', form.claimant_phone]].map(([k, v]) =>
                <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Docs */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Linked Documents</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['PR NO.', form.pr_number], ['QUOTATION NO.', form.quotation_number], ['SR NO.', (form.sr_numbers || []).join(', ') || form.sr_number], ['IR NO.', (form.ir_numbers || []).join(', ') || form.ir_number], ['CLIENT', form.client_name], ['SITE(S)', (form.site_names || []).join(', ') || form.site_name], ['PAYMENT TERM', form.payment_term], ['CLAIM DATE', form.claim_date]].map(([k, v]) =>
                <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Purpose */}
            {form.purpose &&
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>PURPOSE</div>
                <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.5' }}>{form.purpose}</div>
              </div>
            }

            {/* Approval & Payment */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Approval & Payment</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['APPROVED BY', form.approved_by], ['APPROVED DATE', form.approved_date], ['PAID DATE', form.paid_date], ['PAYMENT REF', form.payment_reference]].map(([k, v]) =>
                <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Claim Items</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['#', 'Description', 'Category', 'Qty', 'Unit Cost', 'Total', 'Avg Total'].map((h, i) =>
                    <th key={h} style={{ padding: '7px 10px', textAlign: i > 2 ? 'right' : i === 0 ? 'center' : 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb', width: i === 0 ? '30px' : i === 2 ? '90px' : i > 2 ? '80px' : 'auto' }}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) =>
                  <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace', fontSize: '10px', border: '1px solid #e5e7eb' }}>{i + 1}</td>
                      <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{item.description || '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>{item.category || '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{item.quantity}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{(parseFloat(item.unit_cost) || 0).toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{(parseFloat(item.total) || 0).toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: '#2563eb', border: '1px solid #e5e7eb' }}>{(docCount > 0 ? (parseFloat(item.total) || 0) / docCount : (parseFloat(item.total) || 0)).toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {offDayClaims.some((o) => o.work_date || o.claimed) &&
              <div style={{ marginBottom: '20px' }}>
                  <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Off Day & Hours Claims</span>
                    <span style={{ fontSize: '9px', color: '#6b7280', marginLeft: '8px' }}>(Weekends / Public Holidays — time off in lieu)</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        {['Work Date', 'Work Type', 'Unit', 'Claimed', 'Replacement Date', 'Replacement'].map((h, i) =>
                      <th key={h} style={{ padding: '7px 10px', textAlign: i === 3 || i === 5 ? 'right' : 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb' }}>{h}</th>
                      )}
                      </tr>
                    </thead>
                    <tbody>
                      {offDayClaims.filter((o) => o.work_date || o.claimed).map((item, i) =>
                    <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{item.work_date || '—'}</td>
                          <td style={{ padding: '7px 10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>{item.work_type || '—'}</td>
                          <td style={{ padding: '7px 10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>{item.unit || 'Hours'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{item.claimed || 0}</td>
                          <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{item.replacement_date || '—'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{item.replacement || 0}</td>
                        </tr>
                    )}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', minWidth: '160px' }}>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>Total Claimed</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#111827' }}>{offDayClaimedTotal}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', minWidth: '160px' }}>
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>Total Replacement</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', color: '#111827' }}>{offDayReplacementTotal}</span>
                    </div>
                  </div>
                </div>
              }

              {docCount > 1 &&
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <div style={{ minWidth: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px' }}>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Items Total (raw, {docCount} docs)</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>MYR {itemsTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px' }}>
                    <span style={{ fontSize: '10px', color: '#6b7280' }}>Items Total (avg / {docCount})</span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#111827' }}>MYR {averagedItemsTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              }

              {siteSummary.length > 0 &&
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Total per Site</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '8px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb' }}>Site</th>
                      <th style={{ padding: '6px 10px', textAlign: 'center', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb', width: '80px' }}>Docs</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb', width: '120px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteSummary.map((s, i) =>
                    <tr key={s.site} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb' }}>{s.site}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb' }}>{s.count}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb', border: '1px solid #e5e7eb' }}>MYR {s.total.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr style={{ background: '#eff6ff' }}>
                      <td style={{ padding: '6px 10px', fontWeight: '700', border: '1px solid #e5e7eb' }} colSpan={2}>Total</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb', border: '1px solid #e5e7eb' }}>MYR {siteSummary.reduce((s, x) => s + x.total, 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              }

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <div style={{ minWidth: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Items Total{docCount > 1 ? ' (avg)' : ''}</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#111827' }}>MYR {averagedItemsTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Off Day Claimed</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#111827' }}>{offDayClaimedTotal}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px' }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Off Day Replacement</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#111827' }}>{offDayReplacementTotal}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '2px solid #2563eb' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>Grand Total</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#2563eb', fontFamily: 'monospace' }}>MYR {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {form.remarks &&
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>REMARKS</div>
                <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.5' }}>{form.remarks}</div>
              </div>
            }

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
              {['Claimant', 'Approved By'].map((role) =>
              <div key={role}>
                  <div style={{ height: '50px', borderBottom: '1px solid #9ca3af', marginBottom: '6px' }} />
                  <p style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', margin: 0 }}>{role}</p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', margin: '2px 0 0' }}>
                    {role === 'Claimant' ? form.claimant_name || '________________' : form.approved_by || '________________'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
            <span>Click IX Sdn Bhd · Claim Document · {format(new Date(), 'dd/MM/yyyy')}</span>
            <span>{form.claim_number}</span>
          </div>
        </div>
      </div>
    </div>);

}