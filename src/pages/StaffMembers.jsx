import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ROLES = ['Admin', 'L1', 'L2'];
const ROLE_COLORS = { Admin: 'text-amber-400 bg-amber-500/15', L1: 'text-blue-400 bg-blue-500/15', L2: 'text-indigo-400 bg-indigo-500/15' };
const empty = { name: '', staff_id: '', email: '', phone: '', department: '', role: 'L1', is_active: true };

export default function StaffMembers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.StaffMember.list() });

  const save = useMutation({
    mutationFn: (data) => editId ? base44.entities.StaffMember.update(editId, data) : base44.entities.StaffMember.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setOpen(false); toast.success(editId ? 'Staff updated' : 'Staff added'); },
    onError: (err) => { toast.error(err?.message?.includes('403') || err?.status === 403 ? 'Only admin users can manage staff members.' : `Error: ${err?.message || 'Failed to save'}`); },
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.StaffMember.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); setDeleteId(null); toast.success('Staff removed'); },
    onError: (err) => { toast.error(err?.message?.includes('403') || err?.status === 403 ? 'Only admin users can manage staff members.' : `Error: ${err?.message || 'Failed to delete'}`); },
  });

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (s) => { setForm({ ...s }); setEditId(s.id); setOpen(true); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.staff_id.trim()) { toast.error('Staff ID is required'); return; }
    save.mutate(form);
  };

  const filtered = roleFilter === 'all' ? staff : staff.filter(s => s.role === roleFilter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-heading">Staff Members</h1>
          <p className="text-sm text-muted-foreground mt-1">{staff.length} staff members</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus size={16} /> Add Staff</Button>
      </div>

      <div className="flex gap-2">
        {['all', ...ROLES].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${roleFilter === r ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {r === 'all' ? 'All Roles' : r}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Name', 'Staff ID', 'Department', 'Role', 'Email', 'Phone', 'Active', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Loading...</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-16">
                <UserCog size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No staff found.</p>
              </td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                <td className="px-5 py-3.5 font-medium text-sm">
                  <button onClick={() => navigate(`/staff/${s.id}`)} className="text-left hover:text-primary transition-colors">{s.name}</button>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{s.staff_id}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{s.department || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium', ROLE_COLORS[s.role] || 'bg-muted text-muted-foreground')}>{s.role}</span>
                </td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{s.email || '—'}</td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground">{s.phone || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-mono ${s.is_active ? 'text-emerald-400' : 'text-muted-foreground'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil size={12} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 size={12} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {[['Full Name', 'name', true], ['Staff ID', 'staff_id', true], ['Department', 'department'], ['Email', 'email'], ['Phone', 'phone']].map(([label, key, req]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}{req && <span className="text-red-400 ml-1">*</span>}</Label>
                <Input value={form[key]} onChange={e => setF(key, e.target.value)} className="bg-background" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Role <span className="text-red-400">*</span></Label>
              <Select value={form.role} onValueChange={v => setF('role', v)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Active</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setF('is_active', v)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={save.isPending}>{editId ? 'Update' : 'Add Staff'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader><AlertDialogTitle>Remove Staff Member</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteId)} className="bg-destructive hover:bg-destructive/80">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}