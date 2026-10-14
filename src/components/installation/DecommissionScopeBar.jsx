import { Link2, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getDecommissionSummary, allDecommItemsResolved } from '@/lib/decommissionStaging';

// DecommissionScopeBar shows the partial/full-site toggle, a live summary
// of linked vs unmatched equipment, and completion-readiness. Read-only with
// respect to records — it only reports state and surfaces the confirm dialog.
export default function DecommissionScopeBar({
  sections = [],
  links = [],
  equipment = [],
  decommissionScope,
  fullSiteConfirmed,
  isFullSite,
  onScopeChange,
  onFullSiteConfirm,
}) {
  const summary = getDecommissionSummary(sections, links, equipment);
  const ready = allDecommItemsResolved(sections, links);
  const hasItems = (sections || []).some(s => (s.items || []).some(it => it.device_name || it.serial_number));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-semibold">Decommission Scope:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              className="accent-primary"
              checked={!isFullSite}
              onChange={() => onScopeChange('partial')}
            />
            <span>Partial</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              className="accent-primary"
              checked={isFullSite}
              onChange={() => onScopeChange('full_site')}
            />
            <span>Full Site</span>
          </label>
        </div>

        {isFullSite && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${fullSiteConfirmed ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
            <ShieldCheck size={11} />
            {fullSiteConfirmed ? 'Full-site confirmed' : 'Confirmation required'}
          </span>
        )}
      </div>

      {hasItems && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Link2 size={11} /> {summary.linkedCount} linked
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <AlertTriangle size={11} /> {summary.unmatchedCount} unmatched
          </span>
          {summary.confirmedCount > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 size={11} /> {summary.confirmedCount} confirmed
            </span>
          )}
          {!ready && hasItems && (
            <span className="text-amber-600 dark:text-amber-400">
              {summary.unmatchedCount - summary.confirmedCount} unmatched item(s) need confirmation before completion
            </span>
          )}
        </div>
      )}
    </div>
  );
}