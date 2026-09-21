import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithService } from '../test/renderWithService';
import { GuestJoinPage } from './GuestJoinPage';

function renderJoinPage() {
  return renderWithService(
    <Routes>
      <Route path="/" element={<GuestJoinPage />} />
      <Route path="/status/:partyId" element={<div data-testid="status-page">On status page</div>} />
    </Routes>,
  );
}

describe('GuestJoinPage', () => {
  it('joins the waitlist and navigates to the status page', async () => {
    const user = userEvent.setup();
    const { service } = renderJoinPage();

    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.clear(screen.getByLabelText('Party size'));
    await user.type(screen.getByLabelText('Party size'), '3');
    await user.type(screen.getByLabelText('Phone number'), '555-0199');
    await user.click(screen.getByRole('button', { name: /join waitlist/i }));

    await waitFor(() => expect(screen.getByTestId('status-page')).toBeInTheDocument());

    const parties = await service.listParties();
    expect(parties).toHaveLength(1);
    expect(parties[0]).toMatchObject({ name: 'Jane Doe', partySize: 3, contact: '555-0199' });
  });

  it('shows a validation error and does not submit when the name is missing', async () => {
    const user = userEvent.setup();
    const { service } = renderJoinPage();

    await user.type(screen.getByLabelText('Phone number'), '555-0199');
    await user.click(screen.getByRole('button', { name: /join waitlist/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter your name/i);
    expect(await service.listParties()).toHaveLength(0);
  });
});
