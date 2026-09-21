import { useState, type FormEvent } from 'react';
import { TableStatusBadge } from './StatusBadge';
import { useWaitlistService } from '../services';
import type { RestaurantTable, TableStatus } from '../types/domain';

interface TableGridProps {
  tables: RestaurantTable[];
  onChange: () => void;
}

const STATUS_OPTIONS: TableStatus[] = ['available', 'occupied', 'unavailable'];

export function TableGrid({ tables, onChange }: TableGridProps) {
  const service = useWaitlistService();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCapacity, setNewCapacity] = useState('4');

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

  function handleStatusChange(table: RestaurantTable, status: TableStatus) {
    if (table.partyId) {
      void withBusy(table.id, () => service.releaseTable(table.id));
      return;
    }
    void withBusy(table.id, () => service.updateTableStatus(table.id, status));
  }

  function handleRemove(table: RestaurantTable) {
    void withBusy(table.id, () => service.removeTable(table.id));
  }

  async function handleAddTable(event: FormEvent) {
    event.preventDefault();
    const capacity = Number.parseInt(newCapacity, 10);
    if (!newName.trim() || !Number.isInteger(capacity) || capacity < 1) {
      setError('Enter a table name and a positive capacity.');
      return;
    }
    setError(null);
    try {
      await service.addTable({ name: newName.trim(), capacity });
      setNewName('');
      setNewCapacity('4');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add table.');
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      <div className="table-grid">
        {tables.map((table) => {
          const busy = busyId === table.id;
          return (
            <div key={table.id} className="table-tile">
              <div className="table-tile-header">
                <strong>{table.name}</strong>
                <TableStatusBadge status={table.status} />
              </div>
              <p className="muted">Seats {table.capacity}</p>
              <select
                aria-label={`Change status for table ${table.name}`}
                value={table.status}
                disabled={busy}
                onChange={(e) => handleStatusChange(table, e.target.value as TableStatus)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-danger btn-small"
                disabled={busy || Boolean(table.partyId)}
                onClick={() => handleRemove(table)}
              >
                Remove table
              </button>
            </div>
          );
        })}
      </div>

      <form className="form form-inline" onSubmit={handleAddTable}>
        <label htmlFor="new-table-name">Table name</label>
        <input
          id="new-table-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="T7"
        />
        <label htmlFor="new-table-capacity">Capacity</label>
        <input
          id="new-table-capacity"
          type="number"
          min={1}
          value={newCapacity}
          onChange={(e) => setNewCapacity(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-small">
          Add table
        </button>
      </form>
    </div>
  );
}
