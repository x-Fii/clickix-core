import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</Label>
    {children}
  </div>
);

const genPRNumber = () => `PR-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 900 + 100)}`;

export default function PRForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    pr_number: genPRNumber(),
    pr_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'draft',
    requester_name: '',
    requester_department: '',
    requester_email: '',
    requester_phone: '',
    quotation_id: '',
    quotation_number: '',
    sr_id: '',
    sr_number: '',
    client_name: '',
    site_name: '',
    purpose_of_purchase: '',
    payment_term: '',
    remarks: '',
    approved_by: '',
    approved_date: '',
  });
  const [items, setItems] = useState([
    { item_no: 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }
  ]);

  useQuery({
    queryKey: ['pr', id],
    queryFn: async () => {
      const pr = await base44.entities.PurchaseRequisition.get(id);
      setForm({ ...pr });
      setItems(pr.items?.length ? pr.items : [{ item_no: 1, description: '', category: '', quantity: 1, unit_cost: 0, total: 0 }]);
      return pr;
    },
    enabled: isEdit,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 100),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.PurchaseRequisition.update(id, data)
      : base44.entities.PurchaseRequisition.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast.success(isEdit ? 'PR updated' : 'PR created');
      navigate('/pr');
    },
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleQuotationSelect = (qId) => {
    const q = quotations.find(x => x.id === qId);
    if (q) {
      setForm(f => ({
        ...f,
        quotation_id: q.id,
        quotation_number: q.quotation_number,
        sr_id: q.sr_id || '',
        sr_number: q.sr_number || '',
        client_name: q.client_name || '',
        site_name: q.site_name || '',
      }));
      // Pre-fill items from quotation if no items yet
      if (q.items?.length) {
        setItems(q.items.map((it, i) => ({
          item_no: i + 1,
          description: it.description || '',
          category: '',
          quantity: it.quantity || 1,
          unit_cost: it.unit_cost || 0,
          total: it.total || 0,
        })));
      }
    }
  };

  const handleSRSelect = (srId) => {
    const sr = reports.find(r => r.id === srId);
    if (sr) setForm(f => ({ ...f, sr_id: sr.id, sr_number: sr.running_number, client_name: sr.client_name || '', site_name: sr.site_name || '' }));
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

  const grandTotal = items.reduce((s, it) => s + (it.total || 0), 0);

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
    const wrapper = document.getElementById('pr-pdf-area');
    wrapper.style.display = 'block';
    const pageIds = ['pr-pdf-page-1', 'pr-pdf-page-2'];
    let isFirstPage = true;
    for (const pageId of pageIds) {
      const el = document.getElementById(pageId);
      if (!el || el.offsetHeight < 5) continue;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794 });
      const imgData = canvas.toDataURL('image/png');
      const imgH = (canvas.height * pw) / canvas.width;
      if (!isFirstPage) pdf.addPage();
      isFirstPage = false;
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
    }
    wrapper.style.display = 'none';
    pdf.save(`${form.pr_number}.pdf`);
    toast.success('PDF exported');
  };

  const handleSubmitToAdmin = async () => {
    const adminEmail = prompt('Enter admin email address:');
    if (!adminEmail) return;
    await base44.integrations.Core.SendEmail({
      to: adminEmail,
      subject: `Purchase Requisition ${form.pr_number} — ${form.status?.toUpperCase()}`,
      body: `Purchase Requisition Submission\n\nPR No: ${form.pr_number}\nDate: ${form.pr_date}\nRequester: ${form.requester_name} (${form.requester_department})\nClient: ${form.client_name}\nSite: ${form.site_name}\nQuotation: ${form.quotation_number || '—'}\nSR No: ${form.sr_number || '—'}\nGrand Total: MYR ${grandTotal.toFixed(2)}\nPayment Term: ${form.payment_term}\n\nPurpose: ${form.purpose_of_purchase}\n\nPlease log in to the system to review this PR.`,
    });
    toast.success(`PR submitted to ${adminEmail}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/pr')}><ArrowLeft size={16} className="mr-2" /> Back</Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{isEdit ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}</h1>
              {form.status && (
                <span className={`inline-flex px-2.5 py-0.5 text-[11px] font-mono border rounded-full ${
                  form.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' :
                  form.status === 'submitted' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' :
                  form.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                  'bg-slate-500/15 text-slate-400 border-slate-500/25'
                }`}>{form.status.charAt(0).toUpperCase() + form.status.slice(1)}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{form.pr_number}</p>
          </div>
        </div>
        {isEdit && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => navigate(`/claims/new?from_pr=${id}`)} className="gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
              <GitMerge size={14} /> Convert to Claim
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
              <Download size={14} /> PDF
            </Button>
            <Button size="sm" onClick={handleSubmitToAdmin} className="gap-2">
              <Send size={14} /> Submit to Admin
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Document Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Document Header</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="PR Number"><Input value={form.pr_number} onChange={e => setF('pr_number', e.target.value)} className="bg-background font-mono" /></Field>
            <Field label="PR Date"><Input type="date" value={form.pr_date} onChange={e => setF('pr_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={v => setF('status', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'submitted', 'approved', 'rejected'].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Requester Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Requester Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Requester Name"><Input value={form.requester_name} onChange={e => setF('requester_name', e.target.value)} className="bg-background" placeholder="Full name" /></Field>
            <Field label="Department"><Input value={form.requester_department} onChange={e => setF('requester_department', e.target.value)} className="bg-background" placeholder="e.g. IT, Operations" /></Field>
            <Field label="Email"><Input type="email" value={form.requester_email} onChange={e => setF('requester_email', e.target.value)} className="bg-background" /></Field>
            <Field label="Phone"><Input value={form.requester_phone} onChange={e => setF('requester_phone', e.target.value)} className="bg-background" placeholder="+60 12-xxx xxxx" /></Field>
          </div>
        </div>

        {/* Linked Documents */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Linked Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Quotation">
              <Select value={form.quotation_id || undefined} onValueChange={handleQuotationSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select quotation..." /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {quotations.slice(0, 100).map(q => <SelectItem key={q.id} value={q.id}>{q.quotation_number} — {q.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Service Report">
              <Select value={form.sr_id || undefined} onValueChange={handleSRSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select SR (or auto-filled from quotation)..." /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {reports.slice(0, 100).map(r => <SelectItem key={r.id} value={r.id}>{r.running_number} — {r.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Client Name"><Input value={form.client_name} onChange={e => setF('client_name', e.target.value)} className="bg-background" placeholder="Auto-filled" /></Field>
            <Field label="Site Name"><Input value={form.site_name} onChange={e => setF('site_name', e.target.value)} className="bg-background" placeholder="Auto-filled" /></Field>
          </div>
        </div>

        {/* Purchase Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Purchase Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Purpose of Purchase">
              <Textarea value={form.purpose_of_purchase} onChange={e => setF('purpose_of_purchase', e.target.value)} className="bg-background resize-none" rows={3} placeholder="Describe the purpose and justification for this purchase..." />
            </Field>
            <Field label="Payment Term">
              <Select value={form.payment_term || undefined} onValueChange={v => setF('payment_term', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select payment term..." /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-border">
            <div>
              <h3 className="font-semibold text-sm">Items List</h3>
              <p className="text-xs text-muted-foreground mt-0.5">List of items to be purchased</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addItem}>
              <Plus size={12} /> Add Item
            </Button>
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

        {/* Approval & Remarks */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Approval & Remarks</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Approved By"><Input value={form.approved_by} onChange={e => setF('approved_by', e.target.value)} className="bg-background" placeholder="Approver name" /></Field>
            <Field label="Approved Date"><Input type="date" value={form.approved_date} onChange={e => setF('approved_date', e.target.value)} className="bg-background" /></Field>
            <div className="md:col-span-2">
              <Field label="Remarks">
                <Textarea value={form.remarks} onChange={e => setF('remarks', e.target.value)} className="bg-background resize-none" rows={2} placeholder="Additional notes..." />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate('/pr')}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={saveMutation.isPending}><Save size={14} className="mr-2" /> Save Draft</Button>
          <Button onClick={() => handleSave('submitted')} disabled={saveMutation.isPending}>Submit PR</Button>
        </div>
      </div>

      {/* Hidden PDF Template */}
      <div id="pr-pdf-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>

        {/* PAGE 1 — Header + Requester + Linked Docs + Purchase Details */}
        <div id="pr-pdf-page-1" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
          {/* Header */}
          <div style={{ background: '#0f172a', borderRadius: '8px', padding: '24px 28px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#f8fafc', letterSpacing: '3px', margin: 0 }}>CLICK IX SDN BHD</h1>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', letterSpacing: '1px' }}>PURCHASE REQUISITION</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ background: form.status === 'approved' ? '#10b981' : form.status === 'submitted' ? '#3b82f6' : form.status === 'rejected' ? '#ef4444' : '#64748b', color: 'white', fontWeight: '700', fontSize: '13px', padding: '4px 12px', borderRadius: '4px', fontFamily: 'monospace' }}>
                {form.status?.toUpperCase()}
              </div>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>{form.pr_number}</p>
              <p style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Date: {form.pr_date}</p>
              <p style={{ fontSize: '9px', color: '#64748b' }}>Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
          </div>

          {/* Requester Details */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#3b82f6', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Requester Details</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
              {[['Name', form.requester_name], ['Department', form.requester_department], ['Email', form.requester_email], ['Phone', form.requester_phone]].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: '#eff6ff', borderRadius: '6px', borderLeft: '3px solid #60a5fa' }}>
                  <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                  <p style={{ fontWeight: '600', color: '#1e40af', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Linked Documents */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#a855f7', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Linked Documents</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
              {[['Quotation No.', form.quotation_number], ['SR Number', form.sr_number], ['Client', form.client_name], ['Site', form.site_name]].map(([k, v]) => (
                <div key={k} style={{ padding: '8px 10px', background: '#faf5ff', borderRadius: '6px', borderLeft: '3px solid #c084fc' }}>
                  <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                  <p style={{ fontWeight: '600', color: '#6b21a8', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Details */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '4px', height: '16px', background: '#f59e0b', borderRadius: '2px' }} />
              <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Purchase Details</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '8px' }}>
              <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Purpose of Purchase</p>
                <p style={{ fontSize: '11px', color: '#0f172a', margin: 0, lineHeight: '1.5' }}>{form.purpose_of_purchase || '—'}</p>
              </div>
              <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Payment Term</p>
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', margin: 0 }}>{form.payment_term || '—'}</p>
              </div>
            </div>
          </div>

          {/* Approval */}
          {(form.approved_by || form.approved_date) && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '4px', height: '16px', background: '#10b981', borderRadius: '2px' }} />
                <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Approval</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[['Approved By', form.approved_by], ['Approved Date', form.approved_date]].map(([k, v]) => (
                  <div key={k} style={{ padding: '8px 10px', background: '#ecfdf5', borderRadius: '6px', borderLeft: '3px solid #34d399' }}>
                    <p style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>{k}</p>
                    <p style={{ fontWeight: '600', color: '#065f46', margin: 0, fontSize: '11px' }}>{v || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PAGE 2 — Items Table + Totals + Remarks */}
        <div id="pr-pdf-page-2" style={{ width: '794px', background: 'white', padding: '40px 40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{ width: '4px', height: '16px', background: '#0891b2', borderRadius: '2px' }} />
            <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#164e63', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Items List</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: 'white' }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', width: '30px' }}>#</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', width: '90px' }}>Category</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', width: '50px' }}>Qty</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', width: '90px' }}>Unit Cost</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', width: '90px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace', fontSize: '10px' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '500' }}>{item.description || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{item.category || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{(item.unit_cost || 0).toFixed(2)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>{(item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Grand Total */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px 20px', minWidth: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Grand Total</span>
                <span style={{ color: '#f8fafc', fontWeight: '900', fontSize: '16px', fontFamily: 'monospace' }}>MYR {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {form.remarks && (
            <div style={{ padding: '12px', background: '#fefce8', borderRadius: '6px', border: '1px solid #fde68a', marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Remarks</p>
              <p style={{ fontSize: '11px', color: '#0f172a', margin: 0 }}>{form.remarks}</p>
            </div>
          )}

          {/* Signature Line */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            {['Prepared By', 'Approved By'].map(role => (
              <div key={role}>
                <div style={{ height: '50px', borderBottom: '1px solid #94a3b8', marginBottom: '6px' }} />
                <p style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', margin: 0 }}>{role}</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', margin: '2px 0 0' }}>
                  {role === 'Prepared By' ? (form.requester_name || '________________') : (form.approved_by || '________________')}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
            <span>Click IX Sdn Bhd · Purchase Requisition System</span>
            <span>{form.pr_number} · {format(new Date(), 'dd MMM yyyy')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}