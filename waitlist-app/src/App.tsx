import { Link, Route, Routes } from 'react-router-dom';
import { GuestJoinPage } from './pages/GuestJoinPage';
import { GuestStatusPage } from './pages/GuestStatusPage';
import { StaffDashboardPage } from './pages/StaffDashboardPage';

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
          <Route path="/staff" element={<StaffDashboardPage />} />
          <Route path="*" element={<GuestJoinPage />} />
        </Routes>
      </main>
    </div>
  );
}
