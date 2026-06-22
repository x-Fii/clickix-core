import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Wallet, Wrench, CalendarClock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const ROLE_COLORS = { Admin: 'text-amber-400 bg-amber-500/15', L1: 'text-blue-400 bg-blue-500/15', L2: 'text-indigo-400 bg-indigo-500/15' };
const EXPIRY_DAYS = 90;

const StatCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="bg-card border border-border rounded-xl p-5">
    <div className="flex items-center gap-3 mb-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', accent)}><Icon size={16} /></div>
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-semibold font-heading">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

export default function StaffDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('cases');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.StaffMember.list() });
  const member = staff.find(s => s.id === id);

  const { data: reports = [] } = useQuery({ queryKey: ['service-reports'], queryFn: () => base44.entities.ServiceReport.list('-created_date', 500) });
  const { data: installations = [] } = useQuery({ queryKey: ['installation-reports'], queryFn: () => base44.entities.InstallationReport.list('-created_date', 500) });
  const { data: claims = [] } = useQuery({ queryKey: ['claims'], queryFn: () => base44.entities.Claim.list('-created_date', 500) });

  const name = member?.name;

  const cases = useMemo(() => {
    if (!name) return [];
    const sr = reports.filter(r => r.l1_attended_staff_name === name || r.l2_attended_staff_name === name)
      .map(r => ({ type: 'Service', number: r.running_number, date: r.l1_date || r.l2_attend_date || r.created_date, status: r.status, client: r.client_name, site: r.site_name, id: r.id }));
    const ir = installations.filter(r => r.attended_staff_name === name)
      .map(r => ({ type: 'Installation', number: r.report_number, date: r.installation_date || r.scheduled_date || r.created_date, status: r.status, client: r.client_name, site: r.site_name, id: r.id }));
    return [...sr, ...ir].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [name, reports, installations]);

  const myClaims = useMemo(() => {
    if (!name) return [];
    return claims.filter(c => c.claimant_name === name);
  }, [name, claims]);

  const claimSummary = useMemo(() => {
    const claimed = myClaims.filter(c => ['submitted', 'approved', 'paid'].includes(c.status)).reduce((s, c) => s + (parseFloat(c.grand_total) || 0), 0);
    const paid = myClaims.filter(c => c.status === 'paid').reduce((s, c) => s + (parseFloat(c.grand_total) || 0), 0);
    const pending = myClaims.filter(c => ['submitted', 'approved'].includes(c.status)).reduce((s, c) => s + (parseFloat(c.grand_total) || 0), 0);
    return { claimed, paid, pending, count: myClaims.length };
  }, [myClaims]);

  // Off-day hours/days with 90-day expiry
  const offDayRecords = useMemo(() => {
    if (!name) return [];
    const records = [];
    myClaims.forEach(c => {
      (c.off_day_claims || []).forEach(o => {
        if (!o.work_date) return;
        const accrued = parseISO(o.work_date);
        const expiry = addDays(accrued, EXPIRY_DAYS);
        const today = new Date();
        const daysLeft = differenceInDays(expiry, today);
        const replaced = !!o.replacement_date && o.replacement > 0;
        const expired = !replaced && daysLeft < 0;
        const status = replaced ? 'claimed' : expired ? 'expired' : daysLeft <= 14 ? 'expiring' : 'valid';
        records.push({
          claim_number: c.claim_number,
          work_date: o.work_date,
          work_type: o.work_type,
          unit: o.unit || 'Hours',
          claimed: parseFloat(o.claimed) || 0,
          replacement_date: o.replacement_date,
          replacement: parseFloat(o.replacement) || 0,
          expiry: format(expiry, 'yyyy-MM-dd'),
          daysLeft,
          status,
        });
      });
    });
    return records.sort((a, b) => (b.work_date || '').localeCompare(a.work_date || ''));
  }, [myClaims, name]);

  const offDayTotals = useMemo(() => {
    const valid = offDayRecords.filter(r => r.status !== 'expired');
    const expired = offDayRecords.filter(r => r.status === 'expired');
    const claimed = offDayRecords.filter(r => r.status === 'claimed');
    const byUnit = (unit) => ({
      accrued: valid.filter(r => r.unit === unit).reduce((s, r) => s + r.claimed, 0),
      claimed: claimed.filter(r => r.unit === unit).reduce((s, r) => s + r.replacement, 0),
      expired: expired.filter(r => r.unit === unit).reduce((s, r) => s + r.claimed, 0),
    });
    return { Hours: byUnit('Hours'), Days: byUnit('Days') };
  }, [offDayRecords]);

  const STATUS_STYLE = {
    valid: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    expiring: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    expired: 'text-red-400 bg-red-500/10 border-red-500/20',
    claimed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
  const STATUS_LABEL = { valid: 'Valid', expiring: 'Expiring Soon', expired: 'Expired', claimed: 'Claimed' };

  if (!member) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/staff')} className="mb-4"><ArrowLeft size={16} className="mr-2" /> Back</Button>
        <p className="text-sm text-muted-foreground">Staff member not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/staff')}><ArrowLeft size={16} className="mr-2" /> Back</Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold font-heading">{member.name}</h1>
              <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium', ROLE_COLORS[member.role] || 'bg-muted text-muted-foreground')}>{member.role}</span>
              <span className={cn('text-xs font-mono', member.is_active ? 'text-emerald-400' : 'text-muted-foreground')}>{member.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{member.staff_id} · {member.department || '—'} · {member.email || '—'} · {member.phone || '—'}</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Wrench} label="Cases Attended" value={cases.length} sub={`${cases.filter(c => c.type === 'Service').length} service · ${cases.filter(c => c.type === 'Installation').length} installation`} accent="bg-blue-500/15 text-blue-400" />
        <StatCard icon={Wallet} label="Amount Claimed" value={`MYR ${claimSummary.claimed.toFixed(2)}`} sub={`${claimSummary.count} claims`} accent="bg-indigo-500/15 text-indigo-400" />
        <StatCard icon={CheckCircle2} label="Amount Paid" value={`MYR ${claimSummary.paid.toFixed(2)}`} sub={`MYR ${claimSummary.pending.toFixed(2)} pending`} accent="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={Clock} label="Off-Day Accrued" value={`${offDayTotals.Hours.accrued}h / ${offDayTotals.Days.accrued}d`} sub={`${offDayTotals.Hours.expired}h / ${offDayTotals.Days.expired}d expired`} accent="bg-amber-500/15 text-amber-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { key: 'cases', label: 'Cases Attended' },
          { key: 'claims', label: 'Claims' },
          { key: 'offday', label: 'Off-Day & Hours' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors', tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t.label}</button>
        ))}
      </div>

      {/* Cases */}
      {tab === 'cases' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Type', 'Number', 'Date', 'Client', 'Site', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No cases attended.</td></tr>}
              {cases.map((c, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(c.type === 'Service' ? `/reports/${c.id}` : `/installation/${c.id}`)}>
                  <td className="px-5 py-3"><span className={cn('px-2 py-0.5 rounded text-[11px] font-mono', c.type === 'Service' ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400')}>{c.type}</span></td>
                  <td className="px-5 py-3 font-mono text-xs">{c.number}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{c.date ? format(parseISO(c.date), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-5 py-3 text-sm">{c.client || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{c.site || '—'}</td>
                  <td className="px-5 py-3 text-xs font-mono text-muted-foreground">{c.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Claims */}
      {tab === 'claims' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Claim No.', 'Date', 'Type', 'Client', 'Amount (MYR)', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {myClaims.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No claims submitted.</td></tr>}
              {myClaims.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/claims/${c.id}`)}>
                  <td className="px-5 py-3 font-mono text-xs">{c.claim_number}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{c.claim_date ? format(parseISO(c.claim_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-5 py-3 text-sm">{c.claim_type || '—'}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{c.client_name || '—'}</td>
                  <td className="px-5 py-3 text-sm font-mono">{(parseFloat(c.grand_total) || 0).toFixed(2)}</td>
                  <td className="px-5 py-3"><span className={cn('px-2 py-0.5 rounded-full text-[11px] font-mono', c.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : c.status === 'approved' ? 'bg-blue-500/15 text-blue-400' : c.status === 'rejected' ? 'bg-red-500/15 text-red-400' : 'bg-muted text-muted-foreground')}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Off-Day & Hours */}
      {tab === 'offday' && (
        <div className="space-y-6">
          {/* Summary by unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['Hours', 'Days'].map(unit => (
              <div key={unit} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarClock size={16} className="text-primary" />
                  <h3 className="font-semibold text-sm">{unit} Balance</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xl font-semibold font-heading text-emerald-400">{offDayTotals[unit].accrued}</div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Accrued (valid)</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold font-heading text-blue-400">{offDayTotals[unit].claimed}</div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Claimed / Used</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold font-heading text-red-400">{offDayTotals[unit].expired}</div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Expired</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                  Remaining: <span className="font-mono font-semibold text-foreground">{(offDayTotals[unit].accrued - offDayTotals[unit].claimed)} {unit.toLowerCase()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Off-Day Accrual Records</h3>
              <span className="text-xs text-muted-foreground">Replacement valid within {EXPIRY_DAYS} days of accrual</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Claim', 'Work Date', 'Type', 'Unit', 'Claimed', 'Replacement Date', 'Replacement', 'Expiry', 'Days Left', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {offDayRecords.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">No off-day records.</td></tr>}
                  {offDayRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.claim_number}</td>
                      <td className="px-4 py-3 text-sm">{r.work_date ? format(parseISO(r.work_date), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.work_type || '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono">{r.unit}</td>
                      <td className="px-4 py-3 text-sm font-mono text-right">{r.claimed}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.replacement_date ? format(parseISO(r.replacement_date), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-right">{r.replacement}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.expiry ? format(parseISO(r.expiry), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-right">
                        {r.status === 'claimed' ? '—' : r.status === 'expired' ? <span className="text-red-400">0</span> : <span className={r.daysLeft <= 14 ? 'text-amber-400' : ''}>{r.daysLeft}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border', STATUS_STYLE[r.status])}>
                          {r.status === 'expired' && <XCircle size={10} />}
                          {r.status === 'claimed' && <CheckCircle2 size={10} />}
                          {r.status === 'expiring' && <AlertTriangle size={10} />}
                          {r.status === 'valid' && <Clock size={10} />}
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}