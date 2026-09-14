import { useState } from 'react';
import { PartyStatusBadge } from './StatusBadge';
import { useWaitlistService } from '../services';
import type { Party, PartyStatus, RestaurantTable } from '../types/domain';
import { formatMinutes, formatRelativeTime } from '../utils/time';

interface PartyQueueTableProps {
  parties: Party[];
  tables: RestaurantTable[];
  onChange: () => void;
}

const NEXT_STATUS_OPTIONS: PartyStatus[] = [
  'waiting',
  'arrival_confirmed',
  'table_ready',
  'seated',
  'cancelled',
  'no_show',
];

export function PartyQueueTable({ parties, tables, onChange }: PartyQueueTableProps) {
  const service = useWaitlistService();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableTables = tables.filter((t) => t.status === 'available');

  async function withBusy(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  function handleWaitTimeChange(party: Party, value: string) {
    const minutes = Number.parseInt(value, 10);
    if (!Number.isFinite(minutes) || minutes < 0) return;
    void withBusy(party.id, () => service.updateWaitTime(party.id, minutes));
  }

  function handleStatusChange(party: Party, status: PartyStatus) {
    void withBusy(party.id, () => service.updatePartyStatus(party.id, status));
  }

  function handleAssignTable(party: Party, tableId: string) {
    if (!tableId) return;
    void withBusy(party.id, () => service.assignTable(party.id, tableId));
  }

  function handleRemove(party: Party) {
    void withBusy(party.id, () => service.leaveWaitlist(party.id));
  }

  function moveParty(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= parties.length) return;
    const reordered = [...parties];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    void withBusy(moved.id, () => service.reorderParties(reordered.map((p) => p.id)));
  }

  if (parties.length === 0) {
    return <p className="muted">No parties on the waitlist right now.</p>;
  }

  return (
    <div className="table-scroll">
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <table className="data-table" aria-label="Waitlist queue">
        <thead>
          <tr>
            <th>Party</th>
            <th>Size</th>
            <th>Status</th>
            <th>Wait (min)</th>
            <th>Arrived</th>
            <th>Table</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((party, index) => {
            const assignedTable = tables.find((t) => t.id === party.tableId);
            const busy = busyId === party.id;
            return (
              <tr key={party.id}>
                <td>{party.name}</td>
                <td>{party.partySize}</td>
                <td>
                  <PartyStatusBadge status={party.status} />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="wait-input"
                    aria-label={`Estimated wait for ${party.name}`}
                    defaultValue={party.estimatedWaitMinutes ?? ''}
                    onBlur={(e) => handleWaitTimeChange(party, e.target.value)}
                    disabled={busy}
                    placeholder={formatMinutes(party.estimatedWaitMinutes)}
                  />
                </td>
                <td>{party.arrivalConfirmedAt ? '✅' : '—'}</td>
                <td>
                  {assignedTable ? (
                    assignedTable.name
                  ) : (
                    <select
                      aria-label={`Assign table to ${party.name}`}
                      disabled={busy || availableTables.length === 0}
                      defaultValue=""
                      onChange={(e) => handleAssignTable(party, e.target.value)}
                    >
                      <option value="" disabled>
                        Assign table…
                      </option>
                      {availableTables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name} (seats {table.capacity})
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>{formatRelativeTime(party.createdAt)}</td>
                <td className="actions-cell">
                  <select
                    aria-label={`Change status for ${party.name}`}
                    value={party.status}
                    disabled={busy}
                    onChange={(e) => handleStatusChange(party, e.target.value as PartyStatus)}
                  >
                    {NEXT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${party.name} up`}
                    disabled={busy || index === 0}
                    onClick={() => moveParty(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${party.name} down`}
                    disabled={busy || index === parties.length - 1}
                    onClick={() => moveParty(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    disabled={busy}
                    onClick={() => handleRemove(party)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
