import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, X, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Combobox-style input: pick from list or type freely
const ItemTypeInput = ({ value, onChange, types }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="bg-background text-xs h-8"
        placeholder="Type..."
        list="item-type-options"
      />
      <datalist id="item-type-options">
        {types.map(t => <option key={t} value={t} />)}
      </datalist>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</Label>
    {children}
  </div>
);

const genQuotationNumber = () => `QT-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 900 + 100)}`;

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [form, setForm] = useState({
    quotation_number: genQuotationNumber(),
    quotation_date: format(new Date(), 'yyyy-MM-dd'),
    valid_until: '',
    sr_id: '',
    sr_number: '',
    ir_id: '',
    ir_number: '',
    client_id: '',
    client_name: '',
    site_name: '',
    site_location: '',
    prepared_by: '',
    status: 'draft',
    notes: '',
    tax_percent: 8,
  });
  const [items, setItems] = useState([{ item_code: '', item_type: '', description: '', quantity: 1, unit_cost: 0, total: 0, taxable: true }]);
  const ITEM_TYPES = ['Hardware', 'Software', 'Services', 'Other'];

  useQuery({
    queryKey: ['quotation', id],
    queryFn: async () => {
      const q = await base44.entities.Quotation.get(id);
      setForm({ ...q, tax_percent: q.tax_percent ?? 8 });
      setItems(q.items?.length ? q.items.map(it => ({ item_code: '', item_type: '', taxable: true, ...it })) : [{ item_code: '', item_type: '', description: '', quantity: 1, unit_cost: 0, total: 0, taxable: true }]);
      return q;
    },
    enabled: isEdit,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 100),
  });

  const { data: installationReports = [] } = useQuery({
    queryKey: ['installation-reports'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 100),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.StaffMember.filter({ is_active: true }, 'name', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.Quotation.update(id, data)
      : base44.entities.Quotation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success(isEdit ? 'Quotation updated' : 'Quotation created');
      navigate('/quotations');
    },
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSRSelect = (srId) => {
    if (srId === '__none__') { setForm(f => ({ ...f, sr_id: '', sr_number: '' })); return; }
    const sr = reports.find(r => r.id === srId);
    if (sr) setForm(f => ({ ...f, sr_id: sr.id, sr_number: sr.running_number, ir_id: '', ir_number: '', client_id: sr.client_id || '', client_name: sr.client_name || '', site_name: sr.site_name || '', site_location: sr.site_location || '' }));
  };

  const handleIRSelect = (irId) => {
    if (irId === '__none__') { setForm(f => ({ ...f, ir_id: '', ir_number: '' })); return; }
    const ir = installationReports.find(r => r.id === irId);
    if (ir) setForm(f => ({ ...f, ir_id: ir.id, ir_number: ir.report_number, sr_id: '', sr_number: '', client_id: ir.client_id || '', client_name: ir.client_name || '', site_name: ir.site_name || '', site_location: ir.site_location || '' }));
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

  const subtotal = items.reduce((s, it) => s + (it.total || 0), 0);
  const taxableSubtotal = items.reduce((s, it) => s + (it.taxable ? (it.total || 0) : 0), 0);
  const taxAmt = taxableSubtotal * ((parseFloat(form.tax_percent) || 0) / 100);
  const grandTotal = subtotal + taxAmt;

  const handleSave = (status) => {
    saveMutation.mutate({ ...form, items, subtotal, tax_amount: taxAmt, grand_total: grandTotal, status: status || form.status });
  };

  const handleExportPDF = async () => {
    toast.info('Generating PDF...');
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const wrapper = document.getElementById('qt-pdf-area');
    wrapper.style.display = 'block';
    await new Promise(r => setTimeout(r, 100));
    const el = document.getElementById('qt-pdf-content');
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
    pdf.save(`${form.quotation_number}.pdf`);
    toast.success('PDF exported');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/quotations')}><ArrowLeft size={16} className="mr-2" /> Back</Button>
          <div>
            <h1 className="text-xl font-semibold">{isEdit ? 'Edit Quotation' : 'New Quotation'}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{form.quotation_number}</p>
          </div>
        </div>
        {isEdit && (
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <Download size={14} /> PDF
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Document Header</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Quotation No."><Input value={form.quotation_number} onChange={e => setF('quotation_number', e.target.value)} className="bg-background font-mono" /></Field>
            <Field label="Date"><Input type="date" value={form.quotation_date} onChange={e => setF('quotation_date', e.target.value)} className="bg-background" /></Field>
            <Field label="Valid Until"><Input type="date" value={form.valid_until} onChange={e => setF('valid_until', e.target.value)} className="bg-background" /></Field>
            <Field label="Prepared By">
              <Select value={form.prepared_by || undefined} onValueChange={v => setF('prepared_by', v)}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select staff..." /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {staff.map(s => <SelectItem key={s.id} value={s.name}>{s.name} ({s.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
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

        {/* Linked Report */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-5 border-b border-border">Linked Report & Client Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Service Report">
              <Select value={form.sr_id || '__none__'} onValueChange={handleSRSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select SR..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {reports.map(r => <SelectItem key={r.id} value={r.id}>{r.running_number} — {r.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Installation Report">
              <Select value={form.ir_id || '__none__'} onValueChange={handleIRSelect}>
                <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select IR..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {installationReports.map(r => <SelectItem key={r.id} value={r.id}>{r.report_number} — {r.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Client"><Input value={form.client_name} onChange={e => setF('client_name', e.target.value)} className="bg-background" placeholder="Auto-filled from linked report" /></Field>
            <Field label="Site Name"><Input value={form.site_name} onChange={e => setF('site_name', e.target.value)} className="bg-background" placeholder="Auto-filled from linked report" /></Field>
            <Field label="Site Location"><Input value={form.site_location} onChange={e => setF('site_location', e.target.value)} className="bg-background" placeholder="Auto-filled from linked report" /></Field>
          </div>
        </div>

        {/* Items */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between pb-3 mb-5 border-b border-border">
            <h3 className="font-semibold text-sm">Line Items</h3>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setItems(p => [...p, { item_code: '', item_type: '', description: '', quantity: 1, unit_cost: 0, total: 0, taxable: true }])}>
              <Plus size={12} /> Add Item
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-24 pr-2">Code</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-32 pr-2">Type</th>
                  <th className="text-left pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider pr-3">Description</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-16 pr-3">Qty</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-28 pr-3">Unit Cost</th>
                  <th className="text-right pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-24">Total</th>
                  <th className="text-center pb-2 text-xs font-mono text-muted-foreground uppercase tracking-wider w-12">Tax</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2"><Input value={item.item_code || ''} onChange={e => updateItem(i, 'item_code', e.target.value)} className="bg-background text-xs h-8 font-mono" placeholder="Code" /></td>
                    <td className="py-2 pr-2">
                      <ItemTypeInput value={item.item_type || ''} onChange={v => updateItem(i, 'item_type', v)} types={ITEM_TYPES} />
                    </td>
                    <td className="py-2 pr-3"><Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className="bg-background text-xs h-8" placeholder="Item description" /></td>
                    <td className="py-2 pr-3"><Input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="bg-background text-xs h-8 text-right" min="1" /></td>
                    <td className="py-2 pr-3"><Input type="number" value={item.unit_cost} onChange={e => updateItem(i, 'unit_cost', e.target.value)} className="bg-background text-xs h-8 text-right" min="0" step="0.01" /></td>
                    <td className="py-2 text-right font-mono text-xs">{(item.total || 0).toFixed(2)}</td>
                    <td className="py-2 text-center">
                      <Checkbox checked={!!item.taxable} onCheckedChange={v => updateItem(i, 'taxable', !!v)} />
                    </td>
                    <td className="py-2 pl-2">
                      <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-border pt-4 flex justify-end">
            <div className="space-y-2 text-sm min-w-60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">MYR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tax</span>
                  <Input type="number" value={form.tax_percent} onChange={e => setF('tax_percent', e.target.value)} className="bg-background h-7 w-16 text-xs text-right" min="0" max="100" />
                  <span className="text-muted-foreground text-xs">%</span>
                </div>
                <span className="font-mono">MYR {taxAmt.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span>Grand Total</span>
                <span className="font-mono text-primary">MYR {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-sm pb-3 mb-4 border-b border-border">Notes / Terms</h3>
          <Textarea value={form.notes} onChange={e => setF('notes', e.target.value)} className="bg-background resize-none" rows={3} placeholder="Payment terms, delivery notes, special conditions..." />
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate('/quotations')}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={saveMutation.isPending}><Save size={14} className="mr-2" /> Save Draft</Button>
          <Button onClick={() => handleSave('submitted')} disabled={saveMutation.isPending}>Submit Quotation</Button>
        </div>
      </div>

      {/* Hidden PDF Template */}
      <div id="qt-pdf-area" style={{ display: 'none', position: 'absolute', left: '-9999px', top: 0, fontFamily: 'Arial, sans-serif', color: '#111827' }}>
        <div id="qt-pdf-content" style={{ width: '794px', background: 'white' }}>
          {/* Blue Header */}
          <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' }}>CLICK IX SDN BHD</div>
              <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>QUOTATION</div>
              <div style={{ fontSize: '10px', color: '#bfdbfe', marginTop: '2px', fontFamily: 'monospace' }}>{form.quotation_number}</div>
            </div>
            <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>
              Generated: {format(new Date(), 'dd/MM/yyyy, HH:mm:ss')}
            </div>
          </div>

          <div style={{ padding: '24px 32px 32px' }}>
            {/* Document Info */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Quotation Details</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['DATE', form.quotation_date], ['VALID UNTIL', form.valid_until], ['PREPARED BY', form.prepared_by], ['STATUS', form.status ? form.status.charAt(0).toUpperCase() + form.status.slice(1) : '']].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client & Site */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Client Information</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px 24px' }}>
                {[['CLIENT', form.client_name], ['SITE', form.site_name], ['LOCATION', form.site_location], ['SR / IR REF', form.sr_number || form.ir_number]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#111827' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Line Items</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['#', 'Code', 'Type', 'Description', 'Qty', 'Unit Cost (MYR)', 'Total (MYR)'].map((h, i) => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: i > 3 ? 'right' : i === 0 ? 'center' : 'left', color: '#374151', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', border: '1px solid #e5e7eb', width: i === 0 ? '25px' : i === 1 ? '60px' : i === 2 ? '70px' : i === 4 ? '40px' : i > 4 ? '90px' : 'auto' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#6b7280', fontFamily: 'monospace', fontSize: '10px', border: '1px solid #e5e7eb' }}>{i + 1}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: '10px', border: '1px solid #e5e7eb' }}>{item.item_code || '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#6b7280', border: '1px solid #e5e7eb' }}>{item.item_type || '—'}</td>
                      <td style={{ padding: '7px 10px', border: '1px solid #e5e7eb' }}>{item.description || '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{item.quantity}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{(parseFloat(item.unit_cost) || 0).toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', border: '1px solid #e5e7eb' }}>{(item.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ minWidth: '240px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>Subtotal</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#111827' }}>MYR {subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>Tax ({form.tax_percent || 0}%)</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#111827' }}>MYR {taxAmt.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: '2px solid #2563eb' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>Grand Total</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#2563eb', fontFamily: 'monospace' }}>MYR {grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {form.notes && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>NOTES / TERMS</div>
                <div style={{ fontSize: '12px', color: '#111827', lineHeight: '1.5' }}>{form.notes}</div>
              </div>
            )}

            {/* Signature */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
              {['Prepared By', 'Authorised By'].map(role => (
                <div key={role}>
                  <div style={{ height: '50px', borderBottom: '1px solid #9ca3af', marginBottom: '6px' }} />
                  <p style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', margin: 0 }}>{role}</p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', margin: '2px 0 0' }}>
                    {role === 'Prepared By' ? (form.prepared_by || '________________') : '________________'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
            <span>Click IX Sdn Bhd · Quotation</span>
            <span>{form.quotation_number}</span>
          </div>
        </div>
      </div>
    </div>
  );
}