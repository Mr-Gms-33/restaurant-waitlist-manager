import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../services/authStore';
import { StaffLoginPage } from './StaffLoginPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/login']}>
      <Routes>
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/staff" element={<div data-testid="staff-page">Staff dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StaffLoginPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    authStore.logout();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    authStore.logout();
  });

  it('logs in and navigates to the staff dashboard', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        accessToken: 'tok_123',
        tokenType: 'bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        staffName: 'Pilot Staff',
      }),
    );

    const user = userEvent.setup();
    renderLoginPage();

    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'staff');
    await user.type(screen.getByLabelText('Password'), 'waitlist123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId('staff-page')).toBeInTheDocument());
  });

  it('shows an error message on invalid credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Invalid username or password' }, 401));

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid username or password/i);
  });
});
