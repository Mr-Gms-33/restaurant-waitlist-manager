import { useState } from 'react';
import { PartyQueueTable } from '../components/PartyQueueTable';
import { TableGrid } from '../components/TableGrid';
import { useAuth } from '../hooks/useAuth';
import { useParties } from '../hooks/useParties';
import { useTables } from '../hooks/useTables';

type Tab = 'queue' | 'tables';

export function StaffDashboardPage() {
  const { parties, loading: partiesLoading, error: partiesError, refresh: refreshParties } =
    useParties();
  const { tables, loading: tablesLoading, error: tablesError, refresh: refreshTables } =
    useTables();
  const { staffName, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('queue');

  const activeParties = parties.filter(
    (p) => p.status !== 'seated' && p.status !== 'cancelled' && p.status !== 'no_show',
  );
  const pastParties = parties.filter(
    (p) => p.status === 'seated' || p.status === 'cancelled' || p.status === 'no_show',
  );

  function refreshAll() {
    refreshParties();
    refreshTables();
  }

  return (
    <div className="page page-staff">
      <div className="page-staff-header">
        <h1>Staff dashboard</h1>
        <div className="staff-session">
          {staffName && <span className="muted">Signed in as {staffName}</span>}
          <button type="button" className="btn btn-secondary btn-small" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'queue' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('queue')}
        >
          Waitlist ({activeParties.length})
        </button>
        <button
          type="button"
          className={tab === 'tables' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('tables')}
        >
          Tables ({tables.length})
        </button>
      </div>

      {tab === 'queue' && (
        <section>
          {partiesError && <p className="error-text">{partiesError}</p>}
          {partiesLoading ? (
            <p>Loading waitlist…</p>
          ) : (
            <>
              <h2>Active parties</h2>
              <PartyQueueTable parties={activeParties} tables={tables} onChange={refreshAll} />

              {pastParties.length > 0 && (
                <details className="past-parties">
                  <summary>Past parties ({pastParties.length})</summary>
                  <PartyQueueTable parties={pastParties} tables={tables} onChange={refreshAll} />
                </details>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'tables' && (
        <section>
          {tablesError && <p className="error-text">{tablesError}</p>}
          {tablesLoading ? <p>Loading tables…</p> : <TableGrid tables={tables} onChange={refreshAll} />}
        </section>
      )}
    </div>
  );
}
