import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ServiceReports from './pages/ServiceReports';
import NewReport from './pages/NewReport';
import ReportDetail from './pages/ReportDetail';
import Clients from './pages/Clients';
import Sites from './pages/Sites';
import StaffMembers from './pages/StaffMembers';
import StaffDashboard from './pages/StaffDashboard';
import Quotations from './pages/Quotations';
import QuotationForm from './pages/QuotationForm';
import PurchaseRequisitions from './pages/PurchaseRequisitions';
import PRForm from './pages/PRForm';
import Claims from './pages/Claims';
import ClaimForm from './pages/ClaimForm';
import ScheduleCalendar from './pages/ScheduleCalendar';
import InstallationReports from './pages/InstallationReports';
import InstallationReportForm from './pages/InstallationReportForm';
import InstallationReportDetail from './pages/InstallationReportDetail';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<ServiceReports />} />
        <Route path="/reports/new" element={<NewReport />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/staff" element={<StaffMembers />} />
        <Route path="/staff/:id" element={<StaffDashboard />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/quotations/new" element={<QuotationForm />} />
        <Route path="/quotations/:id" element={<QuotationForm />} />
        <Route path="/pr" element={<PurchaseRequisitions />} />
        <Route path="/pr/new" element={<PRForm />} />
        <Route path="/pr/:id" element={<PRForm />} />
        <Route path="/schedule" element={<ScheduleCalendar />} />
        <Route path="/installation" element={<InstallationReports />} />
        <Route path="/installation/new" element={<InstallationReportForm />} />
        <Route path="/installation/:id/edit" element={<InstallationReportForm />} />
        <Route path="/installation/:id" element={<InstallationReportDetail />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/claims/new" element={<ClaimForm />} />
        <Route path="/claims/:id" element={<ClaimForm />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App