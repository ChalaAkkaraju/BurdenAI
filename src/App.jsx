import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Landing from './components/Landing';
import Dashboard from './components/views/Dashboard';
import DataImport from './components/views/DataImport';
import RawData from './components/views/RawData';
import EmployeeRoster from './components/views/EmployeeRoster';
import BenefitsConfig from './components/views/BenefitsConfig';
import AllocationRules from './components/views/AllocationRules';
import CalculationRuns from './components/views/CalculationRuns';
import Reports from './components/views/Reports';
import AdminConsole from './components/views/AdminConsole';
import ForecastTab from './features/forecast/components/ForecastTab';

const pages = {
  dashboard: Dashboard,
  import: DataImport,
  rawdata: RawData,
  roster: EmployeeRoster,
  benefits: BenefitsConfig,
  allocation: AllocationRules,
  calculations: CalculationRuns,
  forecast: ForecastTab,
  reports: Reports,
  admin: AdminConsole,
};

function AuthedApp() {
  const { isAuthenticated, hasAccess } = useApp();
  const [activePage, setActivePage] = useState('dashboard');
  const [showLogin, setShowLogin] = useState(false);
  if (!isAuthenticated) {
    return (
      <>
        <Landing onSignIn={() => setShowLogin(true)} blurred={showLogin} />
        {showLogin && <Login onClose={() => setShowLogin(false)} />}
      </>
    );
  }
  // Guard: if user lacks access to the active page, fall back to first allowed page.
  const effectivePage = hasAccess(activePage)
    ? activePage
    : (Object.keys(pages).find((p) => hasAccess(p)) || 'dashboard');
  const PageComponent = pages[effectivePage] || Dashboard;
  const guardedSetActivePage = (id) => {
    if (hasAccess(id)) setActivePage(id);
  };
  return (
    <Layout activePage={effectivePage} setActivePage={guardedSetActivePage}>
      <PageComponent />
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthedApp />
    </AppProvider>
  );
}
