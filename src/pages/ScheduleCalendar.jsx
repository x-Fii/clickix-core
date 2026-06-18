import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths,
  addWeeks, subWeeks, startOfWeek, endOfWeek,
  getDay, isToday, parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  schedule:  { dot: 'bg-blue-400',    pill: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  approved:  { dot: 'bg-purple-400',  pill: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  escalated: { dot: 'bg-orange-400',  pill: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  quote:     { dot: 'bg-yellow-400',  pill: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  complete:  { dot: 'bg-emerald-400', pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  reported:  { dot: 'bg-slate-400',   pill: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  resolved:  { dot: 'bg-teal-400',    pill: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
};

// Map each report to the most relevant date for calendar display
function getReportDate(report) {
  // Use the most meaningful date in priority order
  return report.scheduled_date || report.l2_attend_date || report.l1_date || report.created_date;
}

export default function ScheduleCalendar() {
  const [view, setView] = useState('month'); // 'month' | 'week'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 500),
  });

  const { data: installationReports = [], isLoading: isLoadingIR } = useQuery({
    queryKey: ['installation-reports'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 500),
  });

  // Build a map: dateStr -> events[] (service reports + installation reports)
  const dateMap = {};
  reports.forEach(r => {
    const dateStr = getReportDate(r);
    if (!dateStr) return;
    const key = dateStr.slice(0, 10);
    if (!dateMap[key]) dateMap[key] = [];
    dateMap[key].push({ ...r, _type: 'sr' });
  });
  installationReports.forEach(r => {
    const dateStr = r.scheduled_date || r.installation_date || r.created_date;
    if (!dateStr) return;
    const key = dateStr.slice(0, 10);
    if (!dateMap[key]) dateMap[key] = [];
    dateMap[key].push({ ...r, _type: 'ir' });
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to Monday (0=Mon .. 6=Sun)
  const startPad = (getDay(monthStart) + 6) % 7;
  const totalCells = Math.ceil((calDays.length + startPad) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayOffset = i - startPad;
    if (dayOffset < 0 || dayOffset >= calDays.length) return null;
    return calDays[dayOffset];
  });

  // Weekly view days
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const selectedDayStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedReports = selectedDayStr ? (dateMap[selectedDayStr] || []) : [];

  // Legend statuses relevant for scheduling
  const legendItems = [
    { status: 'schedule', label: 'Scheduled Visit' },
    { status: 'approved', label: 'Approved' },
    { status: 'escalated', label: 'Escalated' },
    { status: 'complete', label: 'Completed' },
    { status: 'quote', label: 'Quotation' },
  ];

  // Upcoming scheduled visits (next 30 days) — both SR and IR
  const upcomingSR = reports
    .filter(r => r.status === 'schedule' && r.scheduled_date)
    .map(r => ({ ...r, _type: 'sr' }));
  const upcomingIR = installationReports
    .filter(r => r.status === 'scheduled' && r.scheduled_date)
    .map(r => ({ ...r, _type: 'ir' }));
  const upcoming = [...upcomingSR, ...upcomingIR]
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
            <CalendarDays size={22} className="text-primary" /> Schedule Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Technician visits and maintenance deadlines</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1 text-xs font-mono">
            <button
              onClick={() => setView('month')}
              className={cn('px-3 py-1 rounded transition-colors', view === 'month' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
            >Month</button>
            <button
              onClick={() => setView('week')}
              className={cn('px-3 py-1 rounded transition-colors', view === 'week' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
            >Week</button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
            <button
              onClick={() => view === 'month' ? setCurrentMonth(m => subMonths(m, 1)) : setCurrentWeek(w => subWeeks(w, 1))}
              className="p-1 rounded hover:bg-muted transition-colors"
            ><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold font-mono w-40 text-center">
              {view === 'month'
                ? format(currentMonth, 'MMMM yyyy')
                : `${format(weekStart, 'dd MMM')} – ${format(weekEnd, 'dd MMM yyyy')}`}
            </span>
            <button
              onClick={() => view === 'month' ? setCurrentMonth(m => addMonths(m, 1)) : setCurrentWeek(w => addWeeks(w, 1))}
              className="p-1 rounded hover:bg-muted transition-colors"
            ><ChevronRight size={16} /></button>
            <button
              onClick={() => { setCurrentMonth(new Date()); setCurrentWeek(new Date()); setSelectedDay(new Date()); }}
              className="ml-2 text-xs font-mono px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >Today</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar grid */}
        <div className="xl:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {view === 'month' ? (
            /* Monthly grid */
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (!day) return (
                  <div key={i} className="min-h-[120px] border-b border-r border-border/40 bg-muted/10" />
                );
                const key = format(day, 'yyyy-MM-dd');
                const dayReports = dateMap[key] || [];
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const today = isToday(day);
                const inMonth = isSameMonth(day, currentMonth);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                    className={cn(
                      'min-h-[120px] border-b border-r border-border/40 p-2 text-left transition-colors relative',
                      isSelected ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/40',
                      !inMonth && 'opacity-30',
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold mb-1.5',
                      today ? 'bg-primary text-primary-foreground' : 'text-foreground',
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayReports.slice(0, 3).map((r, ri) => {
                        const sc = STATUS_COLORS[r.status] || STATUS_COLORS.reported;
                        return (
                          <div key={ri} className={cn('text-[10px] px-1.5 py-0.5 rounded border truncate font-mono', sc.pill)}>
                            {r._type === 'ir' ? '📦 ' : ''}{r.site_name || r.running_number || r.report_number}
                          </div>
                        );
                      })}
                      {dayReports.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1 font-mono">+{dayReports.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Weekly grid */
            <div className="grid grid-cols-7">
              {weekDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayReports = dateMap[key] || [];
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const today = isToday(day);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                    className={cn(
                      'min-h-[300px] border-r border-border/40 p-2 text-left transition-colors',
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/40',
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-semibold mb-2 ml-auto',
                      today ? 'bg-primary text-primary-foreground' : 'text-foreground',
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayReports.map((r, ri) => {
                        const sc = STATUS_COLORS[r.status] || STATUS_COLORS.reported;
                        return (
                          <Link
                            key={ri}
                            to={r._type === 'ir' ? `/installation/${r.id}` : `/reports/${r.id}`}
                            onClick={e => e.stopPropagation()}
                            className={cn('block text-[10px] px-1.5 py-1 rounded border font-mono leading-tight', sc.pill)}
                          >
                            <div className="truncate">{r._type === 'ir' ? '📦 ' : ''}{r.site_name || r.running_number || r.report_number}</div>
                            <div className="truncate text-muted-foreground">{r.client_name}</div>
                          </Link>
                        );
                      })}
                      {dayReports.length === 0 && (
                        <p className="text-[10px] text-muted-foreground/40 font-mono text-center pt-4">—</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">Legend</p>
            <div className="space-y-2">
              {legendItems.map(({ status, label }) => (
                <div key={status} className="flex items-center gap-2 text-xs">
                  <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', STATUS_COLORS[status]?.dot)} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected day details */}
          {selectedDay && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {format(selectedDay, 'dd MMM yyyy')}
              </p>
              {selectedReports.length === 0 ? (
                <p className="text-xs text-muted-foreground">No jobs on this day.</p>
              ) : (
                <div className="space-y-2">
                  {selectedReports.map(r => (
                    <Link
                      key={r.id}
                      to={r._type === 'ir' ? `/installation/${r.id}` : `/reports/${r.id}`}
                      className="block p-3 bg-muted/40 rounded-lg border border-border hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-mono text-primary font-semibold">
                          {r._type === 'ir' ? r.report_number : r.running_number}
                        </span>
                        <StatusBadge status={r.status} size="sm" />
                      </div>
                      <p className="text-xs font-medium truncate">{r.site_name || '—'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.client_name || '—'}</p>
                      {r._type === 'ir' && r.attended_staff_name && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">👤 {r.attended_staff_name}</p>
                      )}
                      {r._type === 'sr' && r.l2_attended_staff_name && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">👤 {r.l2_attended_staff_name}</p>
                      )}
                      {r._type === 'ir' && (
                        <p className="text-[10px] text-purple-400 font-mono mt-0.5">📦 Installation</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming scheduled visits */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">Upcoming Scheduled</p>
            {isLoading || isLoadingIR ? (
              <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">No scheduled visits.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(r => (
                <Link
                  key={r.id}
                  to={r._type === 'ir' ? `/installation/${r.id}` : `/reports/${r.id}`}
                  className="block p-2.5 bg-muted/40 rounded-lg border border-border hover:border-blue-400/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-mono text-primary">{r._type === 'ir' ? r.report_number : r.running_number}</span>
                    <span className="text-[10px] font-mono text-blue-400">{r.scheduled_date}</span>
                  </div>
                  <p className="text-xs font-medium truncate mt-0.5">{r.site_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.client_name}</p>
                  {r._type === 'ir' && <p className="text-[10px] text-purple-400 font-mono">📦 Installation</p>}
                </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}