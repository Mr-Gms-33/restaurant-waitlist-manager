import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../services/authStore';
import { RequireStaffAuth } from './RequireStaffAuth';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route path="/staff/login" element={<div data-testid="login-page">Login</div>} />
        <Route
          path="/staff"
          element={
            <RequireStaffAuth>
              <div data-testid="dashboard">Dashboard</div>
            </RequireStaffAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireStaffAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    authStore.logout();
  });

  it('redirects to /staff/login when not authenticated', () => {
    renderProtected();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders the protected content when authenticated', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        accessToken: 'tok_123',
        tokenType: 'bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        staffName: 'Pilot Staff',
      }),
    );
    await authStore.login('staff', 'waitlist123');

    renderProtected();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});
