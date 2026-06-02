import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Save } from 'lucide-react';
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

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/pr')}><ArrowLeft size={16} className="mr-2" /> Back</Button>
        <div>
          <h1 className="text-xl font-semibold">{isEdit ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{form.pr_number}</p>
        </div>
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
              <Select value={form.quotation_id} onValueChange={handleQuotationSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select quotation..." /></SelectTrigger>
                <SelectContent>
                  {quotations.map(q => <SelectItem key={q.id} value={q.id}>{q.quotation_number} — {q.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Service Report">
              <Select value={form.sr_id} onValueChange={handleSRSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select SR (or auto-filled from quotation)..." /></SelectTrigger>
                <SelectContent>
                  {reports.map(r => <SelectItem key={r.id} value={r.id}>{r.running_number} — {r.client_name}</SelectItem>)}
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
              <Select value={form.payment_term} onValueChange={v => setF('payment_term', v)}>
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
    </div>
  );
}