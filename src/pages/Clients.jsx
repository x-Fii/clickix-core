import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Users, Building2, Globe, Phone } from 'lucide-react';
import { toast } from 'sonner';

const empty = { company_name: '', contact_person: '', pic_designation: '', contact_email: '', contact_phone: '', company_website: '', sla: undefined, address: '', notes: '' };

export default function Clients() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  const save = useMutation({
    mutationFn: (data) => editId ? base44.entities.Client.update(editId, data) : base44.entities.Client.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); setOpen(false); toast.success(editId ? 'Client updated' : 'Client added'); },
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); setDeleteId(null); toast.success('Client removed'); },
  });

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm({ ...c }); setEditId(c.id); setOpen(true); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return; }
    save.mutate(form);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-heading">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} registered clients</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus size={16} /> Add Client</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading && <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>}
        {!isLoading && clients.length === 0 && (
          <div className="text-center py-16">
            <Building2 size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No clients yet. Add your first client.</p>
          </div>
        )}
        {!isLoading && clients.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider hidden md:table-cell">Contact Person</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email / Phone</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Website</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">SLA</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.slice().sort((a, b) => (a.company_name || '').localeCompare(b.company_name || '')).map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Users size={11} className="text-primary" />
                      </div>
                      <span className="font-medium text-sm">{c.company_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {c.contact_person && <div>{c.contact_person}</div>}
                    {c.pic_designation && <div className="text-muted-foreground/60">{c.pic_designation}</div>}
                    {!c.contact_person && '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {c.contact_email && <div>{c.contact_email}</div>}
                    {c.contact_phone && <div className="flex items-center gap-1 mt-0.5"><Phone size={10} /> {c.contact_phone}</div>}
                    {!c.contact_email && !c.contact_phone && '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-[160px] truncate">
                    {c.company_website ? <div className="flex items-center gap-1"><Globe size={10} /> {c.company_website}</div> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.sla ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.sla === 'subscribe' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-amber-500/15 text-amber-400 border-amber-500/25'}`}>
                        {c.sla === 'subscribe' ? 'Subscribe' : 'On-Demand'}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil size={12} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 size={12} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Client' : 'Add New Client'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {[['Company Name', 'company_name', 'text', true], ['Contact Person', 'contact_person', 'text'], ['PIC Designation', 'pic_designation', 'text'], ['Contact Email', 'contact_email', 'email'], ['Contact Phone', 'contact_phone', 'text'], ['Company Website', 'company_website', 'text']].map(([label, key, type, req]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}{req && <span className="text-red-400 ml-1">*</span>}</Label>
                <Input type={type} value={form[key]} onChange={e => setF(key, e.target.value)} className="bg-background" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SLA</Label>
              <Select value={form.sla} onValueChange={v => setF('sla', v)}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select SLA type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscribe">Subscribe</SelectItem>
                  <SelectItem value="on-demand">On-Demand</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Textarea value={form.address} onChange={e => setF('address', e.target.value)} className="bg-background resize-none" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea value={form.notes} onChange={e => setF('notes', e.target.value)} className="bg-background resize-none" rows={2} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={save.isPending}>{editId ? 'Update' : 'Add Client'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader><AlertDialogTitle>Delete Client</AlertDialogTitle><AlertDialogDescription>This will permanently remove this client. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteId)} className="bg-destructive hover:bg-destructive/80">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}