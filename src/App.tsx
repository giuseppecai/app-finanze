import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { routes } from './app/routes';
import { AppLayout } from './components/AppLayout';
import { FullScreenLayout } from './components/FullScreenLayout';
import { ToastHost } from './components/Toast';
import { BillsPage } from './features/bills/BillsPage';
import { ClosingPage } from './features/closing/ClosingPage';
import { EntryPage } from './features/entry/EntryPage';
import { HistoryPage } from './features/history/HistoryPage';
import { HomePage } from './features/home/HomePage';
import { LoansPage } from './features/loans/LoansPage';
import { MovementsPage } from './features/movements/MovementsPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { OpeningPage } from './features/opening/OpeningPage';
import { BackupPage } from './features/settings/BackupPage';
import { SettingsPage } from './features/settings/SettingsPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path={routes.home} element={<HomePage />} />
          <Route path={routes.movements} element={<MovementsPage />} />
          <Route path={routes.history} element={<HistoryPage />} />
          <Route path={routes.settings} element={<SettingsPage />} />
        </Route>
        <Route element={<FullScreenLayout />}>
          <Route path={routes.entry} element={<EntryPage />} />
          <Route path={routes.closing} element={<ClosingPage />} />
          <Route path={routes.opening} element={<OpeningPage />} />
          <Route path={routes.loans} element={<LoansPage />} />
          <Route path={routes.recurring} element={<Navigate to={routes.bills} replace />} />
          <Route path={routes.onboarding} element={<OnboardingPage />} />
          <Route path={routes.bills} element={<BillsPage />} />
          <Route path={routes.backup} element={<BackupPage />} />
          <Route path={routes.casa} element={<Navigate to={routes.bills} replace />} />
        </Route>
        <Route path="*" element={<Navigate to={routes.home} replace />} />
      </Routes>
      <ToastHost />
    </HashRouter>
  );
}
