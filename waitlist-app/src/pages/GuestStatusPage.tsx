import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PartyStatusBadge } from '../components/StatusBadge';
import { useParty } from '../hooks/useParty';
import { useWaitlistService } from '../services';
import { formatDeadline, formatMinutes } from '../utils/time';

export function GuestStatusPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const service = useWaitlistService();
  const navigate = useNavigate();
  const { party, queuePosition, loading, error, refresh } = useParty(partyId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirmArrival() {
    if (!partyId) return;
    setBusy(true);
    setActionError(null);
    try {
      await service.confirmArrival(partyId);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not confirm arrival.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!partyId) return;
    setBusy(true);
    setActionError(null);
    try {
      await service.leaveWaitlist(partyId);
      navigate('/');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not leave the waitlist.');
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page page-guest">
        <div className="card">
          <p>Loading your status…</p>
        </div>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="page page-guest">
        <div className="card">
          <h1>We couldn't find that party</h1>
          <p className="muted">{error ?? 'It may have been removed from the waitlist.'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Join the waitlist
          </button>
        </div>
      </div>
    );
  }

  const canConfirmArrival = party.status === 'waiting' || party.status === 'table_ready';
  const canLeave = party.status === 'waiting' || party.status === 'arrival_confirmed';

  return (
    <div className="page page-guest">
      <div className="card">
        <h1>Hi {party.name.split(' ')[0]}!</h1>
        <PartyStatusBadge status={party.status} />

        <dl className="status-details">
          <dt>Party size</dt>
          <dd>{party.partySize}</dd>

          <dt>Estimated wait</dt>
          <dd>{formatMinutes(party.estimatedWaitMinutes)}</dd>

          {queuePosition !== null && (
            <>
              <dt>Position in line</dt>
              <dd>#{queuePosition}</dd>
            </>
          )}
        </dl>

        {party.status === 'table_ready' && (
          <p className="highlight" data-testid="table-ready-message">
            🎉 Your table is ready! Please head to the host stand.
          </p>
        )}

        {party.arrivalDeadline && !party.arrivalConfirmedAt && (
          <p className="muted">{formatDeadline(party.arrivalDeadline)}</p>
        )}

        {actionError && (
          <p role="alert" className="error-text">
            {actionError}
          </p>
        )}

        <div className="button-row">
          {canConfirmArrival && !party.arrivalConfirmedAt && (
            <button className="btn btn-primary" disabled={busy} onClick={handleConfirmArrival}>
              I'm here
            </button>
          )}
          {canLeave && (
            <button className="btn btn-secondary" disabled={busy} onClick={handleLeave}>
              Leave waitlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
