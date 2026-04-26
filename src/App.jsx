import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import RoleRouter from '@/components/layout/RoleRouter';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import TimeTracking from '@/pages/TimeTracking';
import Vendors from '@/pages/Vendors';
import Team from '@/pages/Team';
import UserProfile from '@/pages/UserProfile';
import Reports from '@/pages/Reports';
import PayrollReport from '@/pages/PayrollReport';
import SaifMonthlyReport from '@/pages/SaifMonthlyReport';
import Settings from '@/pages/Settings';
import TimeOff from '@/pages/TimeOff';
import LaborDashboard from '@/pages/LaborDashboard';
import Admin from '@/pages/Admin';
import AP from '@/pages/AP';
import AR from '@/pages/AR';
import ToDoList from '@/pages/ToDoList';
import Employees from '@/pages/Employees';
import EmployeeDetail from '@/pages/EmployeeDetail';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<RoleRouter />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/time" element={<TimeTracking />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/team" element={<Team />} />
        <Route path="/team/:id" element={<UserProfile />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/payroll" element={<PayrollReport />} />
        <Route path="/reports/saif" element={<SaifMonthlyReport />} />
        <Route path="/time-off" element={<TimeOff />} />
        <Route path="/labor" element={<LaborDashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/ap" element={<AP />} />
        <Route path="/ar" element={<AR />} />
        <Route path="/to-do" element={<ToDoList />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
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
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App