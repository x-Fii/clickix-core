import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Boxes, Search } from 'lucide-react';
import { toast } from 'sonner';
import ExportButtons from '@/components/ExportButtons';

const empty = { outlet: '', license_name: '', license_number: '', pc_sku: '', processor: '', anydesk: '', tv_sku: '' };
const FIELDS = [
  ['outlet', 'Outlet'],
  ['license_name', 'License Name'],
  ['license_number', 'License Number'],
  ['pc_sku', 'PC SKU'],
  ['processor', 'Processor'],
  ['anydesk', 'AnyDesk'],
  ['tv_sku', 'TV SKU'],
];

export default function Inventory() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const { data: items = [], isLoading } = useQuery({ queryKey: ['inventory'], queryFn: () => base44.entities.Inventory.list() });

  const save = useMutation({
    mutationFn: (data) => editId ? base44.entities.Inventory.update(editId, data) : base44.entities.Inventory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setOpen(false);
      toast.success(editId ? 'Inventory item updated' : 'Inventory item added');
    },
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.Inventory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setDeleteId(null);
      toast.success('Inventory item deleted');
    },
  });

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm({ ...empty, ...c }); setEditId(c.id); setOpen(true); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => save.mutate(form);

  const q = search.toLowerCase();
  const filtered = items.filter((r) => !q || FIELDS.some(([key]) => String(r[key] || '').toLowerCase().includes(q)));
  const sorted = filtered.slice().sort((a, b) => (a.outlet || '').localeCompare(b.outlet || ''));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
            <Boxes size={22} className="text-primary" /> Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons
            data={sorted}
            fileName="inventory"
            title="Inventory"
            columns={FIELDS.map(([key, header]) => ({ header, accessor: key }))}
          />
          <Button onClick={openNew} className="gap-2"><Plus size={16} /> Add Item</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search outlet, license, SKU, processor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        {isLoading && <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>}
        {!isLoading && items.length === 0 && (
          <div className="text-center py-16">
            <Boxes size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No inventory yet. Add your first item.</p>
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {FIELDS.map(([, header]) => (
                  <th key={header} className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">{header}</th>
                ))}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                  {FIELDS.map(([key]) => (
                    <td key={key} className="px-4 py-3 text-xs">{c[key] || <span className="text-muted-foreground">—</span>}</td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil size={12} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(c.id)}><Trash2 size={12} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {FIELDS.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input value={form[key]} onChange={e => setF(key, e.target.value)} className="bg-background" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={save.isPending}>{editId ? 'Update' : 'Add Item'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteId)} disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}