import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Save, Download, Send, GitMerge, FileEdit, CheckCircle, XCircle } from 'lucide-react';
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

const genPRNumber = () => `PR${format(new Date(), 'yy')}-${String(Math.floor(Math.random() * 9000 + 1000))}`;


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
    approved_amount: '',
  });
  const [items, setItems] = useState([
    { item_no: 1, description: '', category: '', quantity: 1, unit_cost: '', total: 0 }
  ]);

  useQuery({
    queryKey: ['pr', id],
    queryFn: async () => {
      const pr = await base44.entities.PurchaseRequisition.get(id);
      setForm({ ...pr, approved_amount: pr.approved_amount != null ? pr.approved_amount.toString() : '' });
      setItems(pr.items?.length ? pr.items.map(it => ({ ...it, unit_cost: it.unit_cost?.toString() ?? '', quantity: it.quantity?.toString() ?? '1' })) : [{ item_no: 1, description: '', category: '', quantity: '1', unit_cost: '', total: 0 }]);
      return pr;
    },
    enabled: isEdit,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.StaffMember.filter({ is_active: true }, 'name', 100),
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

  const handleCreateDraftQuotation = async () => {
    const genQNum = () => `QT-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 900 + 100)}`;
    const newQ = await base44.entities.Quotation.create({
      quotation_number: genQNum(),
      quotation_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'draft',
      sr_id: form.sr_id || '',
      sr_number: form.sr_number || '',
      client_name: form.client_name || '',
      site_name: form.site_name || '',
      items: items.filter(it => it.description).map(it => ({
        description: it.description,
        quantity: parseFloat(it.quantity) || 1,
        unit_cost: parseFloat(it.unit_cost) || 0,
        total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_cost) || 0),
      })),
      subtotal: grandTotal,
      grand_total: grandTotal,
    });
    setForm(f => ({ ...f, quotation_id: newQ.id, quotation_number: newQ.quotation_number }));
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
    toast.success(`Draft quotation ${newQ.quotation_number} created`);
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

  const addItem = () => setItems(p => [...p, { item_no: p.length + 1, description: '', category: '', quantity: 1, unit_cost: '', total: 0 }]);

  const grandTotal = items.reduce((s, it) => s + (parseFloat(it.unit_cost) || 0) * (parseFloat(it.quantity) || 0), 0);

  const handleSave = (status) => {
    saveMutation.mutate({ ...form, items, subtotal: grandTotal, grand_total: grandTotal, status: status || form.status, approved_amount: parseFloat(form.approved_amount) || null });
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
    await new Promise(r => setTimeout(r, 100));
    const el = document.getElementById('pr-pdf-content');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794 });
    wrapper.style.display = 'none';
    const imgData = canvas.toDataURL('image/png');
    const imgW = pw;
    const imgH = (canvas.height * imgW) / canvas.width;
    let yPos = 0;
    let pageCount = 0;
    while (yPos < imgH) {
      if (pageCount > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -yPos, imgW, imgH);
      yPos += ph;
      pageCount++;
    }
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
            <Field label="Requester Name">
              <Select value={form.requester_name || undefined} onValueChange={v => {
                const s = staff.find(m => m.name === v);
                setForm(f => ({
                  ...f,
                  requester_name: v,
                  requester_department: s?.department || f.requester_department,
                  requester_email: s?.email || f.requester_email,
                  requester_phone: s?.phone || f.requester_phone,
                }));
              }}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select staff..." /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {staff.map(s => <SelectItem key={s.id} value={s.name}>{s.name} ({s.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
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
              <div className="flex gap-2">
                <Select value={form.quotation_id || undefined} onValueChange={handleQuotationSelect}>
                  <SelectTrigger className="bg-background text-sm flex-1"><SelectValue placeholder="Select existing quotation..." /></SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {quotations.slice(0, 100).map(q => <SelectItem key={q.id} value={q.id}>{q.quotation_number} — {q.client_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={handleCreateDraftQuotation} className="gap-1 text-xs whitespace-nowrap text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                  <FileEdit size={12} /> New Draft
                </Button>
              </div>
              {form.quotation_number && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">Linked: {form.quotation_number}</p>
              )}
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
                     {item.category === 'Other' || (item.category && !CATEGORIES.includes(item.category)) ? (
                       <div className="flex gap-1">
                         <Input value={item.category === 'Other' ? '' : item.category} onChange={e => updateItem(i, 'category', e.target.value || 'Other')} className="bg-background text-xs h-8" placeholder="Specify category..." autoFocus />
                         <button onClick={() => updateItem(i, 'category', '')} className="text-muted-foreground hover:text-foreground text-xs px-1">✕</button>
                       </div>
                     ) : (
                       <Select value={item.category || undefined} onValueChange={v => updateItem(i, 'category', v)}>
                         <SelectTrigger className="bg-background text-xs h-8"><SelectValue placeholder="Category" /></SelectTrigger>
                         <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                       </Select>
                     )}
                    </td>
                    <td className="py-2 pr-2"><Input type="text" inputMode="decimal" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="bg-background text-xs h-8 text-right" /></td>
                    <td className="py-2 pr-2"><Input type="text" inputMode="decimal" value={item.unit_cost} onChange={e => updateItem(i, 'unit_cost', e.target.value)} className="bg-background text-xs h-8 text-right" placeholder="0.00" /></td>
                    <td className="py-2 text-right font-mono text-xs">{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)).toFixed(2)}</td>
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
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-border">
            <h3 className="font-semibold text-sm">Approval & Remarks</h3>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
                disabled={form.status === 'rejected' || saveMutation.isPending}
                onClick={() => {
                  setF('status', 'rejected');
                  saveMutation.mutate({ ...form, status: 'rejected', items, subtotal: grandTotal, grand_total: grandTotal, approved_amount: parseFloat(form.approved_amount) || null });
                }}>
                <XCircle size={13} /> Reject
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={form.status === 'approved' || saveMutation.isPending}
                onClick={() => {
                  const today = format(new Date(), 'yyyy-MM-dd');
                  setForm(f => ({ ...f, status: 'approved', approved_date: f.approved_date || today }));
                  saveMutation.mutate({ ...form, status: 'approved', approved_date: form.approved_date || today, items, subtotal: grandTotal, grand_total: grandTotal, approved_amount: parseFloat(form.approved_amount) || null });
                }}>
                <CheckCircle size={13} /> Approve
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Approved By"><Input value={form.approved_by} onChange={e => setF('approved_by', e.target.value)} className="bg-background" placeholder="Approver name" /></Field>
            <Field label="Approved Date"><Input type="date" value={form.approved_date} onChange={e => setF('approved_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Approved Amount (MYR)"><Input type="text" inputMode="decimal" value={form.approved_amount} onChange={e => setF('approved_amount', e.target.value)} className="bg-background font-mono" placeholder="0.00" /></Field>
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
      <div id="pr-pdf-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, fontFamily: 'Arial, sans-serif', color: '#111827' }}>
        <div id="pr-pdf-content" style={{ width: '794px', background: 'white' }}>
          {/* Blue Header */}
          <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' }}>CLICK IX SDN BHD</div>
              <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>PURCHASE REQUISITION</div>
              <div style={{ fontSize: '10px', color: '#bfdbfe', marginTop: '2px', fontFamily: 'monospace' }}>{form.pr_number}</div>
            </div>
            <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>
              Generated: {format(new Date(), 'dd/MM/yyyy, HH:mm:ss')}
            </div>
          </div>

          <div style={{ padding: '24px 32px 32px' }}>
            {/* Requester Details */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Requester Details</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['NAME', form.requester_name], ['DEPARTMENT', form.requester_department], ['EMAIL', form.requester_email], ['PHONE', form.requester_phone]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Documents */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Linked Documents</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['QUOTATION NO.', form.quotation_number], ['SR NUMBER', form.sr_number], ['CLIENT', form.client_name], ['SITE', form.site_name]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Purchase Details */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Purchase Details</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>PURPOSE OF PURCHASE</div>
                  <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.5' }}>{form.purpose_of_purchase || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>PAYMENT TERM</div>
                  <div style={{ fontSize: '12px', color: '#111827' }}>{form.payment_term || '—'}</div>
                </div>
              </div>
            </div>

            {/* Approval */}
            {(form.approved_by || form.approved_date) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Approval</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                  {[['APPROVED BY', form.approved_by], ['APPROVED DATE', form.approved_date], ['APPROVED AMOUNT', form.approved_amount ? `MYR ${parseFloat(form.approved_amount).toFixed(2)}` : null]].filter(([,v]) => v).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                      <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items List */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Items List</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['#', 'Description', 'Category', 'Qty', 'Unit Cost', 'Total'].map((h, i) => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: i > 2 ? 'right' : i === 0 ? 'center' : 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb', width: i === 0 ? '30px' : i === 2 ? '90px' : i > 2 ? '80px' : 'auto' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace', fontSize: '10px', border: '1px solid #e5e7eb' }}>{i + 1}</td>
                      <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{item.description || '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>{item.category || '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{item.quantity}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{(parseFloat(item.unit_cost) || 0).toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grand Total */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ minWidth: '220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '2px solid #2563eb' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>Grand Total</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#2563eb', fontFamily: 'monospace' }}>MYR {grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            {form.remarks && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>REMARKS</div>
                <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.5' }}>{form.remarks}</div>
              </div>
            )}

            {/* Signature Line */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
              {['Prepared By', 'Approved By'].map(role => (
                <div key={role}>
                  <div style={{ height: '50px', borderBottom: '1px solid #9ca3af', marginBottom: '6px' }} />
                  <p style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', margin: 0 }}>{role}</p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', margin: '2px 0 0' }}>
                    {role === 'Prepared By' ? (form.requester_name || '________________') : (form.approved_by || '________________')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
            <span>Click IX Sdn Bhd · Purchase Requisition</span>
            <span>{form.pr_number}</span>
          </div>
        </div>
      </div>
    </div>
  );
}