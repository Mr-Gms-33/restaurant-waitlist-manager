import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createMockWaitlistService } from '../services/mockWaitlistService';
import { renderWithService } from '../test/renderWithService';
import { GuestStatusPage } from './GuestStatusPage';

function renderStatusPage(partyId: string, service = createMockWaitlistService({ latencyMs: 0, seed: false })) {
  return renderWithService(
    <Routes>
      <Route path="/status/:partyId" element={<GuestStatusPage />} />
      <Route path="/" element={<div data-testid="join-page">Join page</div>} />
    </Routes>,
    { service, route: `/status/${partyId}` },
  );
}

describe('GuestStatusPage', () => {
  it('shows the party status, wait time and lets the guest confirm arrival', async () => {
    const service = createMockWaitlistService({ latencyMs: 0, seed: false });
    const party = await service.joinWaitlist({ name: 'Sam Lee', partySize: 2, contact: '555-1' });
    await service.updateWaitTime(party.id, 12);

    renderStatusPage(party.id, service);

    await waitFor(() => expect(screen.getByText(/hi sam!/i)).toBeInTheDocument());
    expect(screen.getByText('12 min')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: "I'm here" }));

    await waitFor(async () => {
      const updated = await service.getParty(party.id);
      expect(updated?.status).toBe('arrival_confirmed');
    });
  });

  it('shows the "table ready" message once staff assigns a table', async () => {
    const service = createMockWaitlistService({ latencyMs: 0, seed: false });
    const party = await service.joinWaitlist({ name: 'Robin', partySize: 4, contact: '555-2' });
    const table = await service.addTable({ name: 'T1', capacity: 4 });
    await service.assignTable(party.id, table.id);

    renderStatusPage(party.id, service);

    expect(await screen.findByTestId('table-ready-message')).toBeInTheDocument();
  });

  it('lets the guest leave the waitlist', async () => {
    const service = createMockWaitlistService({ latencyMs: 0, seed: false });
    const party = await service.joinWaitlist({ name: 'Uma', partySize: 1, contact: '555-3' });

    renderStatusPage(party.id, service);
    await waitFor(() => expect(screen.getByText(/hi uma!/i)).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /leave waitlist/i }));

    await waitFor(() => expect(screen.getByTestId('join-page')).toBeInTheDocument());
    expect(await service.getParty(party.id)).toBeNull();
  });

  it('shows a not-found message for an unknown party id', async () => {
    renderStatusPage('does-not-exist');
    expect(await screen.findByText(/couldn't find that party/i)).toBeInTheDocument();
  });
});
