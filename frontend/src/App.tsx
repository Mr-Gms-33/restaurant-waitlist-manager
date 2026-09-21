import { Link, Route, Routes } from 'react-router-dom';
import { RequireStaffAuth } from './components/RequireStaffAuth';
import { GuestJoinPage } from './pages/GuestJoinPage';
import { GuestStatusPage } from './pages/GuestStatusPage';
import { StaffDashboardPage } from './pages/StaffDashboardPage';
import { StaffLoginPage } from './pages/StaffLoginPage';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">
          🍽️ Waitlist
        </Link>
        <nav>
          <Link to="/staff">Staff dashboard</Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<GuestJoinPage />} />
          <Route path="/status/:partyId" element={<GuestStatusPage />} />
          <Route path="/staff/login" element={<StaffLoginPage />} />
          <Route
            path="/staff"
            element={
              <RequireStaffAuth>
                <StaffDashboardPage />
              </RequireStaffAuth>
            }
          />
          <Route path="*" element={<GuestJoinPage />} />
        </Routes>
      </main>
    </div>
  );
}
