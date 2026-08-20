import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    className: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
  billed: {
    label: 'Billed',
    className: 'bg-pink-500/20 text-pink-300 border-pink-500/30'
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-500/20 text-red-300 border-red-500/30'
  }
};

const TYPE_CONFIG = {
  commissioning: {
    label: 'Comm',
    className: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  decommissioning: {
    label: 'Decomm',
    className: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  }
};

export default function InstallationPDFTest() {
  const { user, isLoadingAuth } = useAuth();

  // Wait until user information is loaded
  if (isLoadingAuth) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  // Only Bianca can access this testing page
  const isPDFTester =
    user?.email?.toLowerCase() === 'bianca@click-ix.com';

  if (!isPDFTester) {
    return <Navigate to="/" replace />;
  }

  return <InstallationPDFTestContent />;
}

function InstallationPDFTestContent() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['installation-reports-pdf-test'],
    queryFn: () =>
      base44.entities.InstallationReport.list('-created_date', 200)
  });

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
          <Wrench size={22} className="text-primary" />
          Installation PDF Testing
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          Testing page for new PDF export method and template.
          This page uses existing Installation Report data.
        </p>
      </div>

      {/* Report Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">

          <thead className="border-b border-border bg-muted/30">
            <tr>
              {[
                'Report No.',
                'Type',
                'DO No.',
                'Client',
                'Site',
                'Date',
                'Technician',
                'Status'
              ].map((heading) => (
                <th
                  key={heading}
                  className="text-left px-4 py-3 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">

            {isLoading ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground"
                >
                  Loading Installation Reports...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground"
                >
                  No installation reports found.
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const status =
                  STATUS_CONFIG[report.status] ||
                  STATUS_CONFIG.pending;

                const type =
                  TYPE_CONFIG[report.report_type] ||
                  TYPE_CONFIG.commissioning;

                return (
                  <tr
                    key={report.id}
                    className="hover:bg-muted/20 transition-colors"
                  >

                    {/* IMPORTANT:
                        Goes to TESTING detail page,
                        NOT the real Installation detail page
                    */}
                    <td className="px-4 py-3 font-mono text-primary text-xs">
                      <Link
                        to={`/installation-pdf-test/${report.id}`}
                        className="hover:underline"
                      >
                        {report.report_number || '—'}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] w-16 flex justify-center ${type.className}`}
                      >
                        {type.label}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {report.do_number || '—'}
                    </td>

                    <td className="px-4 py-3 font-medium text-xs">
                      {report.client_name || '—'}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {report.site_name || '—'}
                    </td>

                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {report.installation_date ||
                        report.scheduled_date ||
                        '—'}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {report.attended_staff_name || '—'}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] w-20 flex justify-center ${status.className}`}
                      >
                        {status.label}
                      </Badge>
                    </td>

                  </tr>
                );
              })
            )}

          </tbody>
        </table>
      </div>
    </div>
  );
}