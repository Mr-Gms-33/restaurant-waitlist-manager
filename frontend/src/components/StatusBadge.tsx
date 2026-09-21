import type { PartyStatus, TableStatus } from '../types/domain';

const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  waiting: 'Waiting',
  arrival_confirmed: 'Arrival confirmed',
  table_ready: 'Table ready',
  seated: 'Seated',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  unavailable: 'Unavailable',
};

export function PartyStatusBadge({ status }: { status: PartyStatus }) {
  return <span className={`badge badge-party-${status}`}>{PARTY_STATUS_LABELS[status]}</span>;
}

export function TableStatusBadge({ status }: { status: TableStatus }) {
  return <span className={`badge badge-table-${status}`}>{TABLE_STATUS_LABELS[status]}</span>;
}
