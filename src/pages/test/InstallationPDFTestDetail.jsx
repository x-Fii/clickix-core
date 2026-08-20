import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function InstallationPDFTestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  // Wait for authentication
  if (isLoadingAuth) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  // Bianca only
  const isPDFTester =
    user?.email?.toLowerCase() === 'bianca@click-ix.com';

  if (!isPDFTester) {
    return <Navigate to="/" replace />;
  }

  return (
    <InstallationPDFTestDetailContent
      id={id}
      navigate={navigate}
    />
  );
}

function InstallationPDFTestDetailContent({ id, navigate }) {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['installation-report-pdf-test', id],
    queryFn: () =>
      base44.entities.InstallationReport.filter({ id }),
  });

  const report = reports[0];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Report not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/installation-pdf-test')}
        >
          <ArrowLeft size={16} />
        </Button>

        <div>
          <h1 className="text-xl font-semibold font-mono">
            {report.report_number}
          </h1>

          <p className="text-xs text-muted-foreground mt-1">
            Installation PDF Testing
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-xs font-mono font-semibold text-muted-foreground uppercase mb-3">
          Test Data
        </p>

        <div className="space-y-2 text-sm">
          <p>
            <strong>Client:</strong>{' '}
            {report.client_name || '—'}
          </p>

          <p>
            <strong>Site:</strong>{' '}
            {report.site_name || '—'}
          </p>

          <p>
            <strong>Technician:</strong>{' '}
            {report.attended_staff_name || '—'}
          </p>

          <p>
            <strong>Report Type:</strong>{' '}
            {report.report_type || '—'}
          </p>
        </div>
      </div>

    </div>
  );
}