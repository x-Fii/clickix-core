import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Save, Download, Send, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CATEGORIES = ['Hardware', 'Software', 'Networking', 'Cabling', 'Consumables', 'Services', 'Other'];
const PAYMENT_TERMS = ['30 Days', '60 Days', '90 Days', 'COD', 'Advance Payment', 'Upon Delivery'];
const CLAIM_TYPES = ['Reimbursement', 'Vendor Payment', 'Contractor Payment', 'Internal Expense', 'Other'];

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</Label>
    {children}
  </div>
);

const genClaimNumber = () => `CLM-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 900 + 100)}`;

const STATUS_COLORS = {
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  submitted: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
  paid: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
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
    client_name: '',
    site_name: '',
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
    remarks: '',
  });
  const [items, setItems] = useState([
    { item_no: 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }
  ]);
  const [prItemSelection, setPrItemSelection] = useState(null); // PR items for selection modal

  // Load existing claim
  useQuery({
    queryKey: ['claim', id],
    queryFn: async () => {
      const c = await base44.entities.Claim.get(id);
      setForm({ ...c });
      setItems(c.items?.length ? c.items : [{ item_no: 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }]);
      return c;
    },
    enabled: isEdit,
  });

  const { data: prs = [] } = useQuery({
    queryKey: ['purchase-requisitions'],
    queryFn: () => base44.entities.PurchaseRequisition.list('-created_date', 100),
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 100),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 100),
  });

  // Auto-load from PR if ?from_pr=id query param
  const fromPrId = searchParams.get('from_pr');
  useQuery({
    queryKey: ['pr-prefill', fromPrId],
    queryFn: async () => {
      const pr = await base44.entities.PurchaseRequisition.get(fromPrId);
      setForm(f => ({
        ...f,
        pr_id: pr.id,
        pr_number: pr.pr_number,
        quotation_id: pr.quotation_id || '',
        quotation_number: pr.quotation_number || '',
        sr_id: pr.sr_id || '',
        sr_number: pr.sr_number || '',
        client_name: pr.client_name || '',
        site_name: pr.site_name || '',
        claimant_name: pr.requester_name || '',
        claimant_department: pr.requester_department || '',
        claimant_email: pr.requester_email || '',
        claimant_phone: pr.requester_phone || '',
        payment_term: pr.payment_term || '',
        purpose: pr.purpose_of_purchase || '',
        approved_by: pr.approved_by || '',
      }));
      // Show PR item selection UI
      if (pr.items?.length) setPrItemSelection(pr.items.map(it => ({ ...it, selected: true })));
      return pr;
    },
    enabled: !!fromPrId && !isEdit,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.Claim.update(id, data)
      : base44.entities.Claim.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      toast.success(isEdit ? 'Claim updated' : 'Claim created');
      navigate('/claims');
    },
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePRSelect = (prId) => {
    const pr = prs.find(x => x.id === prId);
    if (pr) {
      setForm(f => ({
        ...f,
        pr_id: pr.id,
        pr_number: pr.pr_number,
        quotation_id: pr.quotation_id || '',
        quotation_number: pr.quotation_number || '',
        sr_id: pr.sr_id || '',
        sr_number: pr.sr_number || '',
        client_name: pr.client_name || '',
        site_name: pr.site_name || '',
        claimant_name: pr.requester_name || '',
        claimant_department: pr.requester_department || '',
        claimant_email: pr.requester_email || '',
        claimant_phone: pr.requester_phone || '',
        payment_term: pr.payment_term || '',
        purpose: pr.purpose_of_purchase || '',
        approved_by: pr.approved_by || '',
      }));
      if (pr.items?.length) setPrItemSelection(pr.items.map(it => ({ ...it, selected: true })));
    }
  };

  const applyPRItems = () => {
    if (!prItemSelection) return;
    const selected = prItemSelection.filter(it => it.selected).map((it, i) => ({
      item_no: i + 1,
      description: it.description || '',
      category: it.category || '',
      quantity: it.quantity || 1,
      unit_cost: it.unit_cost || 0,
      total: it.total || 0,
    }));
    setItems(selected.length ? selected : [{ item_no: 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }]);
    setPrItemSelection(null);
    toast.success('Items imported from PR');
  };

  const updateItem = (i, field, val) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === 'quantity' || field === 'unit_cost') {
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_cost) || 0);
      }
      return updated;
    }));
  };

  const addItem = () => setItems(p => [...p, { item_no: p.length + 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }]);

  const grandTotal = items.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);

  const handleSave = (status) => {
    saveMutation.mutate({ ...form, items, subtotal: grandTotal, grand_total: grandTotal, status: status || form.status });
  };

  const handleExportPDF = async () => {
    toast.info('Generating PDF...');
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const wrapper = document.getElementById('claim-pdf-area');
    wrapper.style.display = 'block';
    for (const pageId of ['claim-pdf-page-1', 'claim-pdf-page-2']) {
      const el = document.getElementById(pageId);
      if (!el || el.offsetHeight < 5) continue;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794 });
      const imgData = canvas.toDataURL('image/png');
      const imgH = (canvas.height * pw) / canvas.width;
      if (pdf.internal.getNumberOfPages() > 1 || pageId !== 'claim-pdf-page-1') pdf.addPage();
      let remaining = imgH - ph;
      pdf.addImage(imgData, 'PNG', 0, 0, pw, imgH);
      while (remaining > 0) {
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -(imgH - remaining), pw, imgH);
        remaining -= ph;
      }
    }
    wrapper.style.display = 'none';
    pdf.save(`${form.claim_number}.pdf`);
    toast.success('PDF exported');
  };

  const handleSubmitToAdmin = async () => {
    const adminEmail = prompt('Enter admin email address:');
    if (!adminEmail) return;
    await base44.integrations.Core.SendEmail({
      to: adminEmail,
      subject: `Claim ${form.claim_number} — ${form.status?.toUpperCase()}`,
      body: `Claim Submission\n\nClaim No: ${form.claim_number}\nDate: ${form.claim_date}\nClaimant: ${form.claimant_name} (${form.claimant_department})\nType: ${form.claim_type}\nClient: ${form.client_name}\nSite: ${form.site_name}\nLinked PR: ${form.pr_number || '—'}\nSR No: ${form.sr_number || '—'}\nGrand Total: MYR ${grandTotal.toFixed(2)}\n\nPurpose: ${form.purpose}\n\nPlease log in to the system to review this claim.`,
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
              {form.status && (
                <span className={`inline-flex px-2.5 py-0.5 text-[11px] font-mono border rounded-full ${STATUS_COLORS[form.status] || STATUS_COLORS.draft}`}>
                  {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{form.claim_number}</p>
          </div>
        </div>
        {isEdit && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2"><Download size={14} /> PDF</Button>
            <Button size="sm" onClick={handleSubmitToAdmin} className="gap-2"><Send size={14} /> Submit to Admin</Button>
          </div>
        )}
      </div>

      {/* PR Item Selection Banner */}
      {prItemSelection && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GitMerge size={16} className="text-amber-400" />
              <p className="text-sm font-semibold text-amber-400">Select items to include in this claim</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setPrItemSelection(null)}>Skip</Button>
              <Button size="sm" className="text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={applyPRItems}>Apply Selected Items</Button>
            </div>
          </div>
          <div className="space-y-2">
            {prItemSelection.map((item, i) => (
              <label key={i} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${item.selected ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card border-border opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={e => setPrItemSelection(prev => prev.map((it, idx) => idx === i ? { ...it, selected: e.target.checked } : it))}
                  className="rounded"
                />
                <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                <span className="text-sm flex-1">{item.description}</span>
                <span className="text-xs text-muted-foreground">{item.category}</span>
                <span className="text-xs font-mono">Qty: {item.quantity}</span>
                <span className="text-xs font-mono text-primary">MYR {(item.total || 0).toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Document Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Document Header</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Claim Number"><Input value={form.claim_number} onChange={e => setF('claim_number', e.target.value)} className="bg-background font-mono" /></Field>
            <Field label="Claim Date"><Input type="date" value={form.claim_date} onChange={e => setF('claim_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Claim Type">
              <Select value={form.claim_type} onValueChange={v => setF('claim_type', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>{CLAIM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => setF('status', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'submitted', 'approved', 'rejected', 'paid'].map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Claimant Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Claimant Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Claimant Name"><Input value={form.claimant_name} onChange={e => setF('claimant_name', e.target.value)} className="bg-background" placeholder="Full name" /></Field>
            <Field label="Department"><Input value={form.claimant_department} onChange={e => setF('claimant_department', e.target.value)} className="bg-background" /></Field>
            <Field label="Email"><Input type="email" value={form.claimant_email} onChange={e => setF('claimant_email', e.target.value)} className="bg-background" /></Field>
            <Field label="Phone"><Input value={form.claimant_phone} onChange={e => setF('claimant_phone', e.target.value)} className="bg-background" /></Field>
          </div>
        </div>

        {/* Linked Documents */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Linked Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Purchase Requisition (PR)">
              <Select value={form.pr_id} onValueChange={handlePRSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select PR to convert from..." /></SelectTrigger>
                <SelectContent>{prs.map(p => <SelectItem key={p.id} value={p.id}>{p.pr_number} — {p.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Quotation">
              <Select value={form.quotation_id} onValueChange={v => {
                const q = quotations.find(x => x.id === v);
                if (q) setForm(f => ({ ...f, quotation_id: q.id, quotation_number: q.quotation_number }));
              }}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select quotation..." /></SelectTrigger>
                <SelectContent>{quotations.map(q => <SelectItem key={q.id} value={q.id}>{q.quotation_number} — {q.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Service Report">
              <Select value={form.sr_id} onValueChange={v => {
                const sr = reports.find(r => r.id === v);
                if (sr) setForm(f => ({ ...f, sr_id: sr.id, sr_number: sr.running_number, client_name: sr.client_name || '', site_name: sr.site_name || '' }));
              }}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select SR..." /></SelectTrigger>
                <SelectContent>{reports.map(r => <SelectItem key={r.id} value={r.id}>{r.running_number} — {r.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Client"><Input value={form.client_name} onChange={e => setF('client_name', e.target.value)} className="bg-background" placeholder="Auto-filled" /></Field>
            <Field label="Site"><Input value={form.site_name} onChange={e => setF('site_name', e.target.value)} className="bg-background" placeholder="Auto-filled" /></Field>
            <Field label="Payment Term">
              <Select value={form.payment_term} onValueChange={v => setF('payment_term', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Purpose / Justification">
              <Textarea value={form.purpose} onChange={e => setF('purpose', e.target.value)} className="bg-background resize-none" rows={2} placeholder="Describe the purpose of this claim..." />
            </Field>
          </div>
        </div>

        {/* Items */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-border">
            <div>
              <h3 className="font-semibold text-sm">Claim Items</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Items being claimed (can differ from PR)</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addItem}><Plus size={12} /> Add Item</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-center pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-10 pr-2">#</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider pr-2">Description</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-32 pr-2">Category</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-20 pr-2">Qty</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-28 pr-2">Unit Cost</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-28">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2 text-center text-xs text-muted-foreground font-mono">{i + 1}</td>
                    <td className="py-2 pr-2"><Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className="bg-background text-xs h-8" placeholder="Item description" /></td>
                    <td className="py-2 pr-2">
                      <Select value={item.category} onValueChange={v => updateItem(i, 'category', v)}>
                        <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-2"><Input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="bg-background text-xs h-8 text-right" min="1" /></td>
                    <td className="py-2 pr-2"><Input type="number" value={item.unit_cost} onChange={e => updateItem(i, 'unit_cost', e.target.value)} className="bg-background text-xs h-8 text-right" min="0" step="0.01" /></td>
                    <td className="py-2 text-right font-mono text-xs">{(item.total || 0).toFixed(2)}</td>
                    <td className="py-2 pl-2">
                      <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-border pt-4 flex justify-end">
            <div className="flex justify-between font-semibold min-w-60 text-sm">
              <span>Grand Total</span>
              <span className="font-mono text-primary">MYR {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Approval & Payment */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Approval & Payment</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Approved By"><Input value={form.approved_by} onChange={e => setF('approved_by', e.target.value)} className="bg-background" /></Field>
            <Field label="Approved Date"><Input type="date" value={form.approved_date} onChange={e => setF('approved_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Paid Date"><Input type="date" value={form.paid_date} onChange={e => setF('paid_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Payment Reference"><Input value={form.payment_reference} onChange={e => setF('payment_reference', e.target.value)} className="bg-background font-mono" placeholder="e.g. CHQ-001, TT ref" /></Field>
            <div className="md:col-span-2">
              <Field label="Remarks">
                <Textarea value={form.remarks} onChange={e => setF('remarks', e.target.value)} className="bg-background resize-none" rows={2} placeholder="Additional notes..." />
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
      <div id="claim-pdf-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
        {/* PAGE 1 */}
        <div id="claim-pdf-page-1" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
          <div style={{ background: '#0f172a', borderRadius: '8px', padding: '24px 28px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#f8fafc', letterSpacing: '3px', margin: 0 }}>CLICK IX SDN BHD</h1>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', letterSpacing: '1px' }}>CLAIM DOCUMENT</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ background: form.status === 'paid' ? '#14b8a6' : form.status === 'approved' ? '#10b981' : form.status === 'submitted' ? '#3b82f6' : form.status === 'rejected' ? '#ef4444' : '#64748b', color: 'white', fontWeight: '700', fontSize: '13px', padding: '4px 12px', borderRadius: '4px', fontFamily: 'monospace' }}>
                {form.status?.toUpperCase()}
              </div>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>{form.claim_number}</p>
              <p style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Date: {form.claim_date} · Type: {form.claim_type || '—'}</p>
              <p style={{ fontSize: '9px', color: '#64748b' }}>Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
          </div>

          {/* Claimant */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#3b82f6', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Claimant Details</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
              {[['Name', form.claimant_name], ['Department', form.claimant_department], ['Email', form.claimant_email], ['Phone', form.claimant_phone]].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: '#eff6ff', borderRadius: '6px', borderLeft: '3px solid #60a5fa' }}>
                  <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                  <p style={{ fontWeight: '600', color: '#1e40af', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Linked Docs */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#a855f7', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Linked Documents</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
              {[['PR No.', form.pr_number], ['SR No.', form.sr_number], ['Client', form.client_name], ['Site', form.site_name]].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: '#faf5ff', borderRadius: '6px', borderLeft: '3px solid #c084fc' }}>
                  <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', margin: '0 0 3px' }}>{k}</p>
                  <p style={{ fontWeight: '600', color: '#6b21a8', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Purpose */}
          {form.purpose && (
            <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a', marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px' }}>Purpose</p>
              <p style={{ fontSize: '11px', color: '#0f172a', margin: 0 }}>{form.purpose}</p>
            </div>
          )}

          {/* Approval & Payment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
            {[['Approved By', form.approved_by], ['Approved Date', form.approved_date], ['Paid Date', form.paid_date], ['Payment Ref', form.payment_reference]].map(([k, v]) => (
              <div key={k} style={{ padding: '8px 10px', background: '#ecfdf5', borderRadius: '6px', borderLeft: '3px solid #34d399' }}>
                <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', margin: '0 0 3px' }}>{k}</p>
                <p style={{ fontWeight: '600', color: '#065f46', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* PAGE 2 — Items */}
        <div id="claim-pdf-page-2" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{ width: '4px', height: '16px', background: '#0891b2', borderRadius: '2px' }} />
            <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#164e63', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Claim Items</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: 'white' }}>
                {['#', 'Description', 'Category', 'Qty', 'Unit Cost', 'Total'].map((h, i) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: i > 2 ? 'right' : i === 0 ? 'center' : 'left', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', width: i === 0 ? '30px' : i === 2 ? '90px' : i > 2 ? '80px' : 'auto' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace', fontSize: '10px' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '500' }}>{item.description || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{item.category || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{(parseFloat(item.unit_cost) || 0).toFixed(2)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>{(parseFloat(item.total) || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 20px', minWidth: '200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Grand Total</span>
              <span style={{ color: '#f8fafc', fontWeight: '900', fontSize: '16px', fontFamily: 'monospace' }}>MYR {grandTotal.toFixed(2)}</span>
            </div>
          </div>
          {form.remarks && (
            <div style={{ padding: '12px', background: '#fefce8', borderRadius: '6px', border: '1px solid #fde68a', marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px' }}>Remarks</p>
              <p style={{ fontSize: '11px', color: '#0f172a', margin: 0 }}>{form.remarks}</p>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            {['Claimant', 'Approved By'].map(role => (
              <div key={role}>
                <div style={{ height: '50px', borderBottom: '1px solid #94a3b8', marginBottom: '6px' }} />
                <p style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', margin: 0 }}>{role}</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', margin: '2px 0 0' }}>
                  {role === 'Claimant' ? (form.claimant_name || '________________') : (form.approved_by || '________________')}
                </p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
            <span>Click IX Sdn Bhd · Claims System</span>
            <span>{form.claim_number} · {format(new Date(), 'dd MMM yyyy')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}