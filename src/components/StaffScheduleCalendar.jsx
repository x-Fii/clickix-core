import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO, addMonths, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

const TYPE_STYLE = {
  Service: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Installation: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

export default function StaffScheduleCalendar({ events = [] }) {
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsByDate = events.reduce((acc, e) => {
    if (!e.date) return acc;
    const key = format(parseISO(e.date), 'yyyy-MM-dd');
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {});

  const selectedKey = format(selected, 'yyyy-MM-dd');
  const selectedEvents = eventsByDate[selectedKey] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Calendar grid */}
      <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">{format(cursor, 'MMMM yyyy')}</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center"><ChevronLeft size={16} /></button>
            <button onClick={() => { setCursor(new Date()); setSelected(new Date()); }} className="px-3 h-8 rounded-md hover:bg-muted text-xs font-mono">Today</button>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-[10px] font-mono text-muted-foreground uppercase py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate[key] || [];
            const inMonth = isSameMonth(day, cursor);
            const isSel = isSameDay(day, selected);
            return (
              <button
                key={key}
                onClick={() => setSelected(day)}
                className={cn(
                  'min-h-[64px] rounded-md border p-1.5 text-left transition-colors',
                  isSel ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border',
                  !inMonth && 'opacity-30',
                  isToday(day) && !isSel && 'border-primary/40'
                )}
              >
                <div className={cn('text-xs font-mono mb-1', isToday(day) ? 'text-primary font-semibold' : 'text-muted-foreground')}>{format(day, 'd')}</div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e, i) => (
                    <div key={i} className={cn('text-[10px] px-1 py-0.5 rounded truncate border', TYPE_STYLE[e.type] || 'bg-muted text-muted-foreground border-border')}>
                      {e.number}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-1">{format(selected, 'EEEE, dd MMM yyyy')}</h3>
        <p className="text-xs text-muted-foreground mb-4">{selectedEvents.length} scheduled {selectedEvents.length === 1 ? 'job' : 'jobs'}</p>
        <div className="space-y-2">
          {selectedEvents.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No jobs scheduled.</p>}
          {selectedEvents.map((e, i) => (
            <div key={i} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={cn('px-2 py-0.5 rounded text-[11px] font-mono border', TYPE_STYLE[e.type])}>{e.type}</span>
                <span className="font-mono text-xs text-muted-foreground">{e.number}</span>
              </div>
              <div className="text-sm font-medium">{e.client || '—'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{e.site || '—'}</div>
              {e.time && <div className="text-xs text-muted-foreground mt-1 font-mono">{e.time}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}