import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const JOB_COLORS = {
  sr: 'bg-blue-500/80',
  ir: 'bg-indigo-500/80',
};

export default function DashboardCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['sr-calendar'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 500),
  });

  const { data: installationReports = [] } = useQuery({
    queryKey: ['ir-calendar'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 500),
  });

  // Build events map: dateStr -> [{label, type, id, link}]
  const events = {};
  const addEvent = (dateStr, event) => {
    if (!dateStr) return;
    if (!events[dateStr]) events[dateStr] = [];
    events[dateStr].push(event);
  };

  serviceReports.forEach(r => {
    const date = r.scheduled_date || r.l2_attend_date;
    if (date) addEvent(date.slice(0, 10), { label: r.running_number || r.client_name || 'SR', type: 'sr', id: r.id, link: `/reports/${r.id}`, client: r.client_name });
  });

  installationReports.forEach(r => {
    const date = r.scheduled_date || r.installation_date;
    if (date) addEvent(date.slice(0, 10), { label: r.report_number || r.client_name || 'IR', type: 'ir', id: r.id, link: `/installation/${r.id}`, client: r.client_name });
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on correct weekday
  const startPad = monthStart.getDay(); // 0=Sun
  const endPad = 6 - monthEnd.getDay();

  const [selected, setSelected] = useState(null);
  const selectedKey = selected ? format(selected, 'yyyy-MM-dd') : null;
  const selectedEvents = selectedKey ? (events[selectedKey] || []) : [];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">Schedule Calendar</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> SR
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block ml-2" /> IR
          </div>
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-mono w-24 text-center">{format(currentMonth, 'MMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-mono text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-s-${i}`} className="bg-card/50 min-h-[60px]" />
        ))}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = events[key] || [];
          const isToday = isSameDay(day, new Date());
          const isSelected = selected && isSameDay(day, selected);
          return (
            <div
              key={key}
              onClick={() => setSelected(isSelected ? null : day)}
              className={`bg-card min-h-[60px] p-1 cursor-pointer transition-colors hover:bg-muted/40 ${isSelected ? 'ring-1 ring-inset ring-primary' : ''}`}
            >
              <div className={`text-[11px] font-mono w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((ev, i) => (
                  <div key={i} className={`text-[9px] px-1 py-0.5 rounded text-white truncate font-mono ${JOB_COLORS[ev.type]}`}>
                    {ev.label}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
        {Array.from({ length: endPad }).map((_, i) => (
          <div key={`pad-e-${i}`} className="bg-card/50 min-h-[60px]" />
        ))}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs font-mono text-muted-foreground mb-2">{format(selected, 'EEEE, d MMMM yyyy')}</p>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No jobs scheduled.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedEvents.map((ev, i) => (
                <Link key={i} to={ev.link} className="flex items-center gap-2 text-xs hover:text-primary transition-colors group">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${JOB_COLORS[ev.type]}`} />
                  <span className="font-mono text-muted-foreground group-hover:text-primary">{ev.label}</span>
                  {ev.client && <span className="text-muted-foreground truncate">— {ev.client}</span>}
                  <span className="ml-auto text-muted-foreground text-[10px] uppercase">{ev.type === 'sr' ? 'Service' : 'Install'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}