import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWaitlistService } from '../services';

export function GuestJoinPage() {
  const service = useWaitlistService();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const size = Number.parseInt(partySize, 10);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!Number.isInteger(size) || size < 1) {
      setError('Party size must be at least 1.');
      return;
    }
    if (!contact.trim()) {
      setError('Please enter a phone number so we can reach you.');
      return;
    }

    setSubmitting(true);
    try {
      const party = await service.joinWaitlist({ name: name.trim(), partySize: size, contact: contact.trim() });
      navigate(`/status/${party.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page-guest">
      <div className="card">
        <h1>Join the waitlist</h1>
        <p className="muted">No account needed. We'll text you when your table is ready.</p>

        <form onSubmit={handleSubmit} className="form">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoComplete="name"
          />

          <label htmlFor="partySize">Party size</label>
          <input
            id="partySize"
            type="number"
            min={1}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
          />

          <label htmlFor="contact">Phone number</label>
          <input
            id="contact"
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="555-0100"
            autoComplete="tel"
          />

          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Joining…' : 'Join waitlist'}
          </button>
        </form>
      </div>
    </div>
  );
}
