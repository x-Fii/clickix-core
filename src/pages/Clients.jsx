import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const empty = { company_name: '', contact_person: '', contact_email: '', contact_phone: '', address: '', notes: '' };

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
    onError: (err) => { toast.error(`Failed to save client: ${err?.message || 'Permission denied'}`); },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">Loading...</div>}
        {!isLoading && clients.length === 0 && (
          <div className="col-span-3 text-center py-16">
            <Building2 size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No clients yet. Add your first client.</p>
          </div>
        )}
        {clients.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5 group hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center"><Users size={14} className="text-primary" /></div>
                <h3 className="font-semibold text-sm leading-tight">{c.company_name}</h3>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 size={12} /></Button>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {c.contact_person && <p>Contact: {c.contact_person}</p>}
              {c.contact_email && <p>{c.contact_email}</p>}
              {c.contact_phone && <p>{c.contact_phone}</p>}
              {c.address && <p className="truncate">{c.address}</p>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Client' : 'Add New Client'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {[['Company Name', 'company_name', 'text', true], ['Contact Person', 'contact_person', 'text'], ['Contact Email', 'contact_email', 'email'], ['Contact Phone', 'contact_phone', 'text']].map(([label, key, type, req]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}{req && <span className="text-red-400 ml-1">*</span>}</Label>
                <Input type={type} value={form[key]} onChange={e => setF(key, e.target.value)} className="bg-background" />
              </div>
            ))}
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