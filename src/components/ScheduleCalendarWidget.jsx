import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Wrench, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ScheduleCalendarWidget() {
  const [current, setCurrent] = useState(new Date());

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['service-reports-cal'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 500),
  });

  const { data: installationReports = [] } = useQuery({
    queryKey: ['installation-reports-cal'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 500),
  });

  // Build events: SR uses l2_attend_date or scheduled_date, IR uses installation_date or scheduled_date
  const events = [
    ...serviceReports
      .filter(r => r.l2_attend_date || r.scheduled_date)
      .map(r => ({
        id: r.id,
        date: new Date(r.l2_attend_date || r.scheduled_date),
        label: r.site_name || r.client_name || r.running_number,
        sub: r.client_name,
        type: 'sr',
        href: `/reports/${r.id}`,
        status: r.status,
      })),
    ...installationReports
      .filter(r => r.installation_date || r.scheduled_date)
      .map(r => ({
        id: r.id,
        date: new Date(r.installation_date || r.scheduled_date),
        label: r.site_name || r.client_name || r.report_number,
        sub: r.client_name,
        type: 'ir',
        href: `/installation/${r.id}`,
        status: r.status,
      })),
  ];

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // pad start
  const startPad = getDay(monthStart); // 0=Sun
  const paddedDays = [...Array(startPad).fill(null), ...days];

  const getEventsForDay = (day) => day ? events.filter(e => isSameDay(e.date, day)) : [];

  const today = new Date();

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">Schedule Calendar</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(subMonths(current, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-mono w-28 text-center">{format(current, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrent(addMonths(current, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><Wrench size={11} className="text-blue-400" /> Service</div>
        <div className="flex items-center gap-1.5"><Package size={11} className="text-indigo-400" /> Installation</div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-mono text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {paddedDays.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const isToday = day && isSameDay(day, today);
          const inMonth = day && isSameMonth(day, current);
          return (
            <div key={i} className={`bg-card min-h-[72px] p-1 ${!inMonth ? 'opacity-0 pointer-events-none' : ''}`}>
              {day && (
                <>
                  <span className={`text-[11px] font-mono block text-right mb-0.5 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <Link key={ev.id} to={ev.href} className={`block truncate text-[10px] px-1 py-0.5 rounded font-medium leading-tight ${ev.type === 'sr' ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-orange-500/20 text-white-300 hover:bg-orange-500/30'}`}>
                        {ev.label}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}