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
  cancelled:  { label: 'Cancelled',  className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const TYPE_CONFIG = {
  commissioning:    { label: 'Commissioning',   className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  decommissioning:  { label: 'Decommissioning', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
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
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['installation-report', id]);
      queryClient.invalidateQueries(['installation-reports']);
      toast({ title: 'Report marked as completed' });
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
          {report.status !== 'completed' && report.status !== 'cancelled' && (
            <Button variant="outline" size="sm" onClick={() => markCompleteMutation.mutate()} disabled={markCompleteMutation.isPending}>
              <CheckCircle size={14} className="mr-1" /> Mark Complete
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
          <Field label="Attend Time" value={report.attend_time} />
          <Field label="Technician" value={report.attended_staff_name} />
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

      {/* Technician Notes */}
      {report.technician_notes && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Technician Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{report.technician_notes}</p>
        </div>
      )}

      {/* Acknowledgement */}
      {(report.ack_name || report.ack_phone) && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Acknowledgement</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={report.ack_name} />
            <Field label="Phone" value={report.ack_phone} />
          </div>
          {report.ack_timestamp && <Field label="Timestamp" value={new Date(report.ack_timestamp).toLocaleString()} />}
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
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', background: '#fff', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: '12px' }} ref={pdfRef}>
        {/* Header */}
        <div style={{ background: '#1e3a5f', color: '#fff', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '1px' }}>CLICK IX SDN BHD</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>Installation Report</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: '700' }}>{report.report_number}</div>
            <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '4px', textTransform: 'uppercase' }}>{tc.label}</div>
            <div style={{ marginTop: '6px', background: report.status === 'completed' ? '#16a34a' : '#3b82f6', padding: '2px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', display: 'inline-block' }}>{sc.label}</div>
          </div>
        </div>

        <div style={{ padding: '24px 32px' }}>
          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '14px' }}>
              <div style={{ fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '10px', letterSpacing: '0.05em' }}>Client & Site</div>
              {[['Client', report.client_name], ['Site / Outlet', report.site_name], ['Location', report.site_location], ['Site PIC', report.site_pic_name]].filter(([,v]) => v).map(([l, v]) => (
                <div key={l} style={{ marginBottom: '6px' }}><span style={{ color: '#6b7280', fontSize: '10px' }}>{l}: </span><span style={{ fontWeight: '600' }}>{v}</span></div>
              ))}
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '14px' }}>
              <div style={{ fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '10px', letterSpacing: '0.05em' }}>Schedule & Attendance</div>
              {[['Scheduled Date', report.scheduled_date], ['Installation Date', report.installation_date], ['Attend Time', report.attend_time], ['Technician', report.attended_staff_name], ['Quotation No.', report.work_order_number], ['Reported By', report.reported_by]].filter(([,v]) => v).map(([l, v]) => (
                <div key={l} style={{ marginBottom: '6px' }}><span style={{ color: '#6b7280', fontSize: '10px' }}>{l}: </span><span style={{ fontWeight: '600' }}>{v}</span></div>
              ))}
            </div>
          </div>

          {/* Equipment */}
          {equipment && equipment.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', color: '#1e3a5f', marginBottom: '10px', borderBottom: '2px solid #1e3a5f', paddingBottom: '4px' }}>
                {report.report_type === 'commissioning' ? 'Equipment Installed' : 'Equipment Decommissioned'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Type</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Name / Model</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Serial Number</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>
                      {report.report_type === 'commissioning' ? 'Notes' : 'Reason'}
                    </th>
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
            </div>
          )}

          {/* Technician Notes */}
          {report.technician_notes && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', color: '#1e3a5f', marginBottom: '8px', borderBottom: '2px solid #1e3a5f', paddingBottom: '4px' }}>Technician Notes</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', background: '#f9fafb', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{report.technician_notes}</div>
            </div>
          )}

          {/* Acknowledgement */}
          {(report.ack_name || report.ack_phone) && (
            <div style={{ marginTop: '24px', borderTop: '2px solid #e5e7eb', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '4px' }}>Acknowledged By</div>
                <div style={{ fontWeight: '600' }}>{report.ack_name}</div>
                <div style={{ color: '#6b7280' }}>{report.ack_phone}</div>
                {report.ack_timestamp && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>{new Date(report.ack_timestamp).toLocaleString()}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', marginBottom: '4px' }}>Signature</div>
                <div style={{ border: '1px solid #e5e7eb', height: '60px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '10px' }}>
                  {report.ack_signature ? <img src={report.ack_signature} alt="sig" style={{ maxHeight: '56px' }} /> : 'No signature captured'}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af' }}>
            <span>Generated on {new Date().toLocaleDateString()}</span>
            <span>Click IX Sdn Bhd — Confidential</span>
          </div>
        </div>
      </div>
    </div>
  );
}