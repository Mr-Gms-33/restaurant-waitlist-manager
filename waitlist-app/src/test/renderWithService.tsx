import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WaitlistServiceProvider } from '../services/ServiceProvider';
import { createMockWaitlistService, type MockWaitlistServiceOptions } from '../services/mockWaitlistService';
import type { WaitlistService } from '../services/WaitlistService';

interface RenderOptions {
  service?: WaitlistService;
  serviceOptions?: MockWaitlistServiceOptions;
  route?: string;
}

/** Renders UI wrapped with a fresh mock service and a router, for component tests. */
export function renderWithService(ui: ReactElement, options: RenderOptions = {}) {
  const service =
    options.service ??
    createMockWaitlistService({ latencyMs: 0, persist: false, seed: false, ...options.serviceOptions });

  const result = render(
    <WaitlistServiceProvider service={service}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
    </WaitlistServiceProvider>,
  );

  return { ...result, service };
}
