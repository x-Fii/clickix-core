import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const ReadField = ({ label, value }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mb-1">{label}</p>
    <p className="text-sm">{value || <span className="text-muted-foreground/50">—</span>}</p>
  </div>
);

export default function L1ReadOnly({ report }) {
  const [summaryCopied, setSummaryCopied] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="pb-3 border-b border-border flex-1">
          <h3 className="font-semibold text-sm">L1 Remote Support</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Remote attendance record</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <ReadField label="Reported By" value={report.reported_by} />
        <ReadField label="DO Number" value={report.do_number} />
        <ReadField label="L1 Staff" value={report.l1_attended_staff_name} />
        <ReadField label="Staff ID" value={report.l1_attended_staff_id} />
        <ReadField label="Staff Email" value={report.l1_attended_staff_email} />
        <ReadField label="Date" value={report.l1_date} />
        <ReadField label="Report ID" value={report.running_number} />
        <ReadField label="L1 Status" value={report.l1_status ? report.l1_status.charAt(0).toUpperCase() + report.l1_status.slice(1) : ''} />
      </div>

      {(report.l1_issue_statement || report.l1_issue_pillar?.length > 0 || report.l1_rectification_done) &&
        <div className="mb-6 space-y-3">
          {report.l1_issue_statement &&
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Issue Statement</p>
              <p className="text-sm whitespace-pre-wrap">{report.l1_issue_statement}</p>
            </div>
          }
          {report.l1_issue_pillar?.length > 0 &&
            <div className="flex flex-wrap gap-1.5 items-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mr-1">Issue Pillar:</p>
              {report.l1_issue_pillar.map((p, i) => (
                <span key={i} className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{p || 'Other'}</span>
              ))}
            </div>
          }
          {report.l1_rectification_done &&
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Rectification Done</p>
              <p className="text-sm whitespace-pre-wrap">{report.l1_rectification_done}</p>
            </div>
          }
        </div>
      }
      {(report.l1_affected_sections?.length > 0 || report.l1_affected_items?.length > 0) &&
      <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-3">Affected Items</p>
          {report.l1_affected_sections?.length > 0 ?
        <div className="space-y-3">
              {report.l1_affected_sections.map((sec, si) =>
          <div key={si} className="border border-primary/20 rounded-lg p-3 space-y-2 bg-muted/10">
                  <p className="text-xs font-semibold text-primary">{sec.section_name || `Section ${si + 1}`}</p>
                  <div className="space-y-1.5 pl-2 border-l-2 border-border">
                    {(sec.items || []).map((item, ii) =>
              <div key={ii} className="flex gap-3 p-2 bg-card rounded text-sm border border-border">
                        <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded flex-shrink-0 h-fit">{item.device_type}</span>
                        <span className="font-medium flex-shrink-0">{item.device_name}</span>
                        <span className="text-muted-foreground">{item.issue_description}</span>
                      </div>
              )}
                    </div>
                  </div>
          )}
            </div> :

        <div className="space-y-2">
              {report.l1_affected_items.map((item, i) =>
          <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                  <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded flex-shrink-0 h-fit">{item.device_type}</span>
                  <span className="font-medium flex-shrink-0">{item.device_name}</span>
                  <span className="text-muted-foreground">{item.issue_description}</span>
                </div>
          )}
            </div>
        }
        </div>
      }

      {/* L1 Session Summary */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            L1 Session Summary
          </p>

          <button
            onClick={() => {
              const lines = [
                `• Response ID: ${report.whatsapp_response_id || '—'}`,
                `• Site Name: ${report.site_name || '—'}`,
                `• Reported By: ${report.reported_by || '—'}`,
                `• DO Number: ${report.do_number || '—'}`,
                ...(report.l1_issue_statement
                  ? [`• Issue Statement: ${report.l1_issue_statement}`]
                  : []),
                ...(report.l1_issue_pillar?.length
                  ? [`• Issue Pillar: ${report.l1_issue_pillar.filter(Boolean).join(', ')}`]
                  : []),
                ...(report.l1_rectification_done
                  ? [`• Rectification Done: ${report.l1_rectification_done}`]
                  : []),
                ...(report.l1_affected_sections?.length > 0
                  ? report.l1_affected_sections.flatMap((sec, si) =>
                      (sec.items || [])
                        .filter((i) => i.device_type || i.issue_description)
                        .map(
                          (item) =>
                            `• Section: ${sec.section_name || `Section ${si + 1}`}${
                              item.device_type
                                ? ` — Device: ${item.device_type}${
                                    item.device_name ? ` (${item.device_name})` : ''
                                  }`
                                : ''
                            }${
                              item.issue_description
                                ? ` — Issue: ${item.issue_description}`
                                : ''
                            }`
                        )
                    )
                  : (report.l1_affected_items || [])
                      .filter((i) => i.device_type)
                      .map(
                        (item) =>
                          `• Device: ${item.device_type}${
                            item.device_name ? ` (${item.device_name})` : ''
                          }${
                            item.issue_description
                              ? ` — Issue: ${item.issue_description}`
                              : ''
                          }`
                      )),
                `• Remarks: ${report.l1_remarks || '—'}`,
                `• L1 Status: ${
                  report.l1_status
                    ? report.l1_status.charAt(0).toUpperCase() +
                      report.l1_status.slice(1)
                    : '—'
                }`
              ];

              navigator.clipboard.writeText(lines.join('\n'));
              setSummaryCopied(true);
              setTimeout(() => setSummaryCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted/50"
          >
            {summaryCopied ? (
              <Check size={12} className="text-emerald-400" />
            ) : (
              <Copy size={12} />
            )}

            {summaryCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-xs space-y-1 text-foreground leading-relaxed">
          <p>
            • <span className="text-muted-foreground">Response ID:</span>{' '}
            {report.whatsapp_response_id || '—'}
          </p>

          <p>
            • <span className="text-muted-foreground">Site Name:</span>{' '}
            {report.site_name || '—'}
          </p>

          <p>
            • <span className="text-muted-foreground">Reported By:</span>{' '}
            {report.reported_by || '—'}
          </p>

          <p>
            • <span className="text-muted-foreground">DO Number:</span>{' '}
            {report.do_number || '—'}
          </p>

          {report.l1_issue_statement && (
            <p>
              • <span className="text-muted-foreground">Issue Statement:</span>{' '}
              {report.l1_issue_statement}
            </p>
          )}

          {report.l1_issue_pillar?.length > 0 && (
            <p>
              • <span className="text-muted-foreground">Issue Pillar:</span>{' '}
              {report.l1_issue_pillar.filter(Boolean).join(', ')}
            </p>
          )}

          {report.l1_rectification_done && (
            <p>
              • <span className="text-muted-foreground">Rectification Done:</span>{' '}
              {report.l1_rectification_done}
            </p>
          )}

          {report.l1_affected_sections?.length > 0
            ? report.l1_affected_sections.map((sec, si) =>
                (sec.items || [])
                  .filter((i) => i.device_type || i.issue_description)
                  .map((item, ii) => (
                    <div key={`${si}-${ii}`} className="space-y-1">
                      <p>
                        • <span className="text-muted-foreground">Section:</span>{' '}
                        {sec.section_name || `Section ${si + 1}`}
                      </p>

                      {item.device_type && (
                        <p>
                          • <span className="text-muted-foreground">Device:</span>{' '}
                          {item.device_type}
                          {item.device_name ? ` (${item.device_name})` : ''}
                        </p>
                      )}

                      {item.issue_description && (
                        <p>
                          • <span className="text-muted-foreground">Issue:</span>{' '}
                          {item.issue_description}
                        </p>
                      )}
                    </div>
                  ))
              )
            : (report.l1_affected_items || [])
                .filter((i) => i.device_type)
                .map((item, i) => (
                  <div key={i} className="space-y-1">
                    <p>
                      • <span className="text-muted-foreground">Device:</span>{' '}
                      {item.device_type}
                      {item.device_name ? ` (${item.device_name})` : ''}
                    </p>

                    {item.issue_description && (
                      <p>
                        • <span className="text-muted-foreground">Issue:</span>{' '}
                        {item.issue_description}
                      </p>
                    )}
                  </div>
                ))}

          <div>
            <p className="uppercase">
              • <span className="text-muted-foreground">Remarks:</span>
            </p>

            {report.l1_remarks ? (
              <div className="pl-4 whitespace-pre-wrap uppercase">
                {report.l1_remarks
                  .split(/\s+-\s+/)
                  .map((part, index) => (
                    <div key={index}>
                      {index === 0 ? part : `- ${part}`}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="pl-4 text-muted-foreground">—</div>
            )}
          </div>

          <p>
            • <span className="text-muted-foreground">L1 Status:</span>{' '}
            <span className="font-bold">
              {report.l1_status
                ? report.l1_status.charAt(0).toUpperCase() +
                  report.l1_status.slice(1)
                : '—'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}