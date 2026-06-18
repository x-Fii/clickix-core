import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, MapPin, Phone, User } from 'lucide-react';
import { toast } from 'sonner';

const MY_STATES = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'];
const REGIONS = ['Central', 'Northern', 'Southern', 'East Coast', 'East Malaysia'];

const empty = { client_id: '', client_name: '', site_name: '', site_location: '', state: '', region: '', pic_name: '', pic_phone: '', notes: '' };

export default function Sites() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [clientFilter, setClientFilter] = useState('all');

  const { data: sites = [], isLoading } = useQuery({ queryKey: ['sites'], queryFn: () => base44.entities.Site.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  const save = useMutation({
    mutationFn: (data) => editId ? base44.entities.Site.update(editId, data) : base44.entities.Site.create(data),
    onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['sites'] });setOpen(false);toast.success(editId ? 'Site updated' : 'Site added');}
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.Site.delete(id),
    onSuccess: () => {queryClient.invalidateQueries({ queryKey: ['sites'] });setDeleteId(null);toast.success('Site removed');}
  });

  const openNew = () => {setForm(empty);setEditId(null);setOpen(true);};
  const openEdit = (s) => {setForm({ ...s });setEditId(s.id);setOpen(true);};
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleClientChange = (id) => {
    const c = clients.find((c) => c.id === id);
    setForm((f) => ({ ...f, client_id: id, client_name: c?.company_name || '' }));
  };

  const handleSave = () => {
    if (!form.site_name.trim()) {toast.error('Site name is required');return;}
    if (!form.client_id) {toast.error('Please select a client');return;}
    save.mutate(form);
  };

  const filtered = (clientFilter === 'all' ? sites : sites.filter((s) => s.client_id === clientFilter)).
  slice().
  sort((a, b) => {
    const regionCmp = (a.region || '').localeCompare(b.region || '');
    if (regionCmp !== 0) return regionCmp;
    const stateCmp = (a.state || '').localeCompare(b.state || '');
    if (stateCmp !== 0) return stateCmp;
    return (a.site_name || '').localeCompare(b.site_name || '');
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-heading">Sites / Outlets</h1>
          <p className="text-sm text-muted-foreground mt-1">{sites.length} registered sites</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus size={16} /> Add Site</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setClientFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${clientFilter === 'all' ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>All</button>
        {clients.map((c) =>
        <button key={c.id} onClick={() => setClientFilter(c.id)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${clientFilter === c.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>{c.company_name}</button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading && <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>}
        {!isLoading && filtered.length === 0 &&
        <div className="text-center py-16">
            <MapPin size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No sites found.</p>
          </div>
        }
        {!isLoading && filtered.length > 0 &&
        <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Site Name</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Region</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">State</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider hidden lg:table-cell">PIC</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
              const showRegionHeader = i === 0 || filtered[i - 1].region !== s.region;
              return [
              showRegionHeader &&
              <tr key={`region-${s.region}-${i}`} className="bg-muted/50">
                      <td colSpan={7} className="px-4 py-2 text-xs font-mono font-semibold text-primary uppercase tracking-wider">
                        {s.region || 'No Region'}
                      </td>
                    </tr>,

              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="pr-4 pb-3 pl-4 pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                          <MapPin size={11} className="text-indigo-400" />
                        </div>
                        <span className="font-medium text-xs">{s.site_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.client_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.region || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.state || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{s.site_location || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {s.pic_name ?
                  <div className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1"><User size={10} /> {s.pic_name}</div>
                          {s.pic_phone && <div className="flex items-center gap-1 mt-0.5"><Phone size={10} /> {s.pic_phone}</div>}
                        </div> :
                  <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil size={12} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 size={12} /></Button>
                      </div>
                    </td>
                  </tr>];

            })}
            </tbody>
          </table>
        }
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Site' : 'Add New Site'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client <span className="text-red-400">*</span></Label>
              <Select value={form.client_id} onValueChange={handleClientChange}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Select value={form.state || undefined} onValueChange={(v) => setF('state', v)}>
                  <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select state..." /></SelectTrigger>
                  <SelectContent className="max-h-60">{MY_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Region</Label>
                <Select value={form.region || undefined} onValueChange={(v) => setF('region', v)}>
                  <SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select region..." /></SelectTrigger>
                  <SelectContent>{REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {[['Site Name', 'site_name', true], ['Site Location', 'site_location'], ['PIC Name', 'pic_name'], ['PIC Phone', 'pic_phone']].map(([label, key, req]) =>
            <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{label}{req && <span className="text-red-400 ml-1">*</span>}</Label>
                <Input value={form[key]} onChange={(e) => setF(key, e.target.value)} className="bg-background" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setF('notes', e.target.value)} className="bg-background resize-none" rows={2} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={save.isPending}>{editId ? 'Update' : 'Add Site'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader><AlertDialogTitle>Delete Site</AlertDialogTitle><AlertDialogDescription>This will permanently remove this site.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(deleteId)} className="bg-destructive hover:bg-destructive/80">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}