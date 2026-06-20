import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, CheckCircle, FileText, Package, PackageMinus, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  scheduled:  { label: 'Scheduled',  className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  completed:  { label: 'Completed',  className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  billed:     { label: 'Billed',     className: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const TYPE_CONFIG = {
  commissioning:    { label: 'Open',   className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  decommissioning:  { label: 'Close', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default function InstallationReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pdfRef = useRef(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!pdfRef.current) return;
    setExportingPdf(true);
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 0;
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, -y, imgW, imgH);
        remaining -= pageH;
        if (remaining > 0) { pdf.addPage(); y += pageH; }
      }
      pdf.save(`${report.report_number}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['installation-report', id],
    queryFn: () => base44.entities.InstallationReport.filter({ id }),
  });
  const report = reports[0];

  const markCompleteMutation = useMutation({
    mutationFn: () => base44.entities.InstallationReport.update(id, {
      status: 'completed',
      submitted: true,
      submitted_at: new Date().toISOString(),
      ack_timestamp: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['installation-report', id]);
      queryClient.invalidateQueries(['installation-reports']);
      toast({ title: 'Report marked as completed' });
    },
  });

  const markBilledMutation = useMutation({
    mutationFn: () => base44.entities.InstallationReport.update(id, { status: 'billed' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['installation-report', id]);
      queryClient.invalidateQueries(['installation-reports']);
      toast({ title: 'Report marked as billed' });
    },
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!report) return (
    <div className="p-6 text-center text-muted-foreground">Report not found.</div>
  );

  const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
  const tc = TYPE_CONFIG[report.report_type] || TYPE_CONFIG.commissioning;
  const equipment = report.report_type === 'commissioning' ? report.equipment_installed : report.equipment_decommissioned;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/installation')}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold font-heading font-mono">{report.report_number}</h1>
              <Badge variant="outline" className={`text-[10px] ${tc.className}`}>{tc.label}</Badge>
              <Badge variant="outline" className={`text-[10px] ${sc.className}`}>{sc.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Created {new Date(report.created_date).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report.status !== 'completed' && report.status !== 'cancelled' && report.status !== 'billed' && (
            <Button variant="outline" size="sm" onClick={() => markCompleteMutation.mutate()} disabled={markCompleteMutation.isPending}>
              <CheckCircle size={14} className="mr-1" /> Mark Complete
            </Button>
          )}
          {report.status === 'completed' && (
            <Button variant="outline" size="sm" onClick={() => markBilledMutation.mutate()} disabled={markBilledMutation.isPending}>
              <CheckCircle size={14} className="mr-1" /> Mark Billed
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
            <Download size={14} className="mr-1" /> {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </Button>
          <Button size="sm" asChild>
            <Link to={`/installation/${id}/edit`}><Pencil size={14} className="mr-1" /> Edit</Link>
          </Button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Client & Site */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Client & Site</h2>
          <Field label="Client" value={report.client_name} />
          <Field label="Site / Outlet" value={report.site_name} />
          <Field label="Location" value={report.site_location} />
          <Field label="Site PIC" value={report.site_pic_name} />
        </div>

        {/* Schedule */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Schedule & Attendance</h2>
          <Field label="Scheduled Date" value={report.scheduled_date} />
          <Field label="Installation Date" value={report.installation_date} />
          <Field label="Installation Finish Date" value={report.installation_finish_date} />
          <Field label="Attend Time" value={report.attend_time} />
          {report.ack_timestamp && <Field label="Completed At" value={new Date(report.ack_timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} />}
          <Field label="Technician" value={report.attended_staff_name} />
          <Field label="DO Number" value={report.do_number} />
          <Field label="Work Order No." value={report.work_order_number} />
          <Field label="Reported By" value={report.reported_by} />
        </div>
      </div>

      {/* Equipment */}
      {equipment && equipment.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            {report.report_type === 'commissioning'
              ? <><Package size={14} /> Equipment Installed</>
              : <><PackageMinus size={14} /> Equipment Decommissioned</>}
          </h2>
          <div className="space-y-4">
            {equipment.map((item, i) => (
              <div key={i} className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Device Type" value={item.device_type} />
                  <Field label="Device Name" value={item.device_name} />
                  <Field label="Serial Number" value={item.serial_number} />
                  {item.notes && <Field label="Notes" value={item.notes} />}
                  {item.reason_for_decommission && <Field label="Reason" value={item.reason_for_decommission} />}
                </div>
                {item.photos && item.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.photos.map((url, pi) => (
                      <a key={pi} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded border border-border hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-Job Site Assessment */}
      {(report.pre_job_assessment || (report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0)) && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Pre-Job Site Assessment</h2>
          {report.pre_job_assessment && <p className="text-sm whitespace-pre-wrap">{report.pre_job_assessment}</p>}
          {report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.pre_job_assessment_photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded border border-border hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Job Technician Note */}
      {report.technician_notes && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Post Job Technician Note</h2>
          <p className="text-sm whitespace-pre-wrap">{report.technician_notes}</p>
        </div>
      )}

      {/* Acknowledgement */}
      {(report.ack_name || report.ack_phone || report.ack_signature) && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Acknowledgement</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={report.ack_name} />
            <Field label="Phone" value={report.ack_phone} />
          </div>
          {report.ack_timestamp && <Field label="Timestamp" value={new Date(report.ack_timestamp).toLocaleString()} />}
          {report.ack_signature && (
            <div>
              <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1">Signature</p>
              <img src={report.ack_signature} alt="Signature" className="max-w-xs h-24 object-contain border border-border rounded bg-white p-1" />
            </div>
          )}
        </div>
      )}

      {/* Supporting Photos */}
      {report.supporting_photos && report.supporting_photos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Package size={14} /> Supporting Photos
          </h2>
          <div className="flex flex-wrap gap-3">
            {report.supporting_photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Photo ${i + 1}`} className="w-28 h-28 object-cover rounded border border-border hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Supporting Documents */}
      {report.supporting_documents && report.supporting_documents.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText size={14} /> Supporting Documents
          </h2>
          <div className="space-y-1">
            {report.supporting_documents.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block text-xs text-primary hover:underline">
                Document {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Hidden PDF Template */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', background: '#fff', color: '#111827', fontFamily: 'Arial, sans-serif', fontSize: '12px' }} ref={pdfRef}>
        {/* Header */}
        <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' }}>CLICK IX SDN BHD</div>
            <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>INSTALLATION REPORT</div>
            <div style={{ fontSize: '10px', color: '#bfdbfe', marginTop: '2px', fontFamily: 'monospace' }}>{report.report_number}</div>
          </div>
          <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>
            Generated: {new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })}, {new Date().toLocaleTimeString()}
          </div>
        </div>

        <div style={{ padding: '24px 32px' }}>
          {/* Job Information */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Job Information</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[['TECHNICIAN', report.attended_staff_name], ['TECHNICIAN EMAIL', report.attended_staff_email], ['STORE', report.site_name], ['LOCATION', report.site_location], ['DO NUMBER', report.do_number], ['WORK ORDER NUMBER', report.work_order_number], ['SITE PIC', report.site_pic_name], ['REPORTED BY', report.reported_by], ['CLIENT', report.client_name], ['REPORT TYPE', tc.label]].filter(([,v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule & Attendance */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Schedule & Attendance</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[['SCHEDULED DATE', report.scheduled_date], ['INSTALLATION DATE', report.installation_date], ['INSTALLATION FINISH DATE', report.installation_finish_date], ['ATTEND TIME', report.attend_time], ['STATUS', sc.label]].filter(([,v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment */}
          {equipment && equipment.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>{report.report_type === 'commissioning' ? 'Equipment Installed' : 'Equipment Decommissioned'}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Type</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Name / Model</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Serial Number</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>{report.report_type === 'commissioning' ? 'Notes' : 'Reason'}</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((item, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{i + 1}</td>
                      <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{item.device_type}</td>
                      <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{item.device_name}</td>
                      <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{item.serial_number}</td>
                      <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{item.notes || item.reason_for_decommission}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {equipment.some(item => item.photos && item.photos.length > 0) && (
                <div style={{ marginTop: '12px' }}>
                  {equipment.map((item, i) => item.photos && item.photos.length > 0 && (
                    <div key={i} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '6px', fontWeight: '600' }}>Item {i + 1} — {item.device_name} Photos:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {item.photos.map((url, pi) => (
                          <img key={pi} src={url} alt="" crossOrigin="anonymous" style={{ width: '240px', height: '180px', objectFit: 'cover', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pre-Job Site Assessment */}
          {(report.pre_job_assessment || (report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0)) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Pre-Job Site Assessment</span>
              </div>
              {report.pre_job_assessment && <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', padding: '12px', background: '#f9fafb', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '12px', marginBottom: '10px' }}>{report.pre_job_assessment}</div>}
              {report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {report.pre_job_assessment_photos.map((url, i) => (
                    <img key={i} src={url} alt="" crossOrigin="anonymous" style={{ width: '200px', height: '160px', objectFit: 'cover', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Post Job Technician Note */}
          {report.technician_notes && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Post Job Technician Note</span>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', padding: '12px', background: '#f9fafb', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '12px' }}>{report.technician_notes}</div>
            </div>
          )}

          {/* Supporting Photos */}
          {report.supporting_photos && report.supporting_photos.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Photo Evidence</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {report.supporting_photos.map((url, i) => (
                  <img key={i} src={url} alt="" crossOrigin="anonymous" style={{ width: '280px', height: '210px', objectFit: 'cover', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                ))}
              </div>
            </div>
          )}

          {/* Client Signature */}
          {(report.ack_name || report.ack_phone || report.ack_signature) && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Client Signature</span>
              </div>
              {report.ack_signature
                ? <img src={report.ack_signature} alt="sig" crossOrigin="anonymous" style={{ maxHeight: '100px', maxWidth: '220px', display: 'block', marginBottom: '12px' }} />
                : <div style={{ border: '1px solid #e5e7eb', height: '70px', width: '220px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '10px', marginBottom: '12px' }}>No signature captured</div>
              }
              <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Name:</strong> {report.ack_name}</div>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Phone:</strong> {report.ack_phone}</div>
              {report.ack_timestamp && <div style={{ fontSize: '12px', color: '#6b7280' }}>Signed on: {new Date(report.ack_timestamp).toLocaleString()}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
          <span>Page 1 of 1 | Installation Report</span>
          <span>{report.report_number}</span>
        </div>
      </div>
    </div>
  );
}