import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockWaitlistService } from '../services/mockWaitlistService';
import { renderWithService } from '../test/renderWithService';
import { StaffDashboardPage } from './StaffDashboardPage';

async function setup() {
  const service = createMockWaitlistService({ latencyMs: 0, seed: false });
  await service.joinWaitlist({ name: 'Nora Kim', partySize: 2, contact: '555-1' });
  await service.addTable({ name: 'T1', capacity: 2 });

  const utils = renderWithService(<StaffDashboardPage />, { service });
  await waitFor(() => expect(screen.getByText('Nora Kim')).toBeInTheDocument());
  return { ...utils, service };
}

describe('StaffDashboardPage', () => {
  it('lists active parties in the waitlist tab', async () => {
    await setup();
    expect(screen.getByRole('table', { name: /waitlist queue/i })).toBeInTheDocument();
    expect(screen.getByText('Nora Kim')).toBeInTheDocument();
  });

  it('lets staff set an estimated wait time', async () => {
    const { service } = await setup();
    const user = userEvent.setup();

    const waitInput = screen.getByLabelText('Estimated wait for Nora Kim');
    await user.clear(waitInput);
    await user.type(waitInput, '18');
    await user.tab();

    await waitFor(async () => {
      const [party] = await service.listParties();
      expect(party.estimatedWaitMinutes).toBe(18);
    });
  });

  it('lets staff assign an available table to a party', async () => {
    const { service } = await setup();
    const user = userEvent.setup();

    const assignSelect = screen.getByLabelText('Assign table to Nora Kim');
    await user.selectOptions(assignSelect, screen.getByRole('option', { name: /T1/i }));

    await waitFor(async () => {
      const [party] = await service.listParties();
      expect(party.status).toBe('table_ready');
      expect(party.tableId).toBeTruthy();
    });
    expect(await screen.findByText('T1')).toBeInTheDocument();
  });

  it('lets staff change a party status directly', async () => {
    const { service } = await setup();
    const user = userEvent.setup();

    const statusSelect = screen.getByLabelText('Change status for Nora Kim');
    await user.selectOptions(statusSelect, 'cancelled');

    await waitFor(async () => {
      const [party] = await service.listParties();
      expect(party.status).toBe('cancelled');
    });
  });

  it('switches to the tables tab and adds a new table', async () => {
    const { service } = await setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^tables/i }));
    expect(screen.getByText('T1')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Table name'), 'T2');
    const capacityInput = screen.getByLabelText('Capacity');
    await user.clear(capacityInput);
    await user.type(capacityInput, '6');
    await user.click(screen.getByRole('button', { name: /add table/i }));

    await waitFor(async () => {
      const tables = await service.listTables();
      expect(tables.map((t) => t.name)).toContain('T2');
    });
    expect(await within(screen.getByText('T2').closest('.table-tile')!).findByText('Seats 6')).toBeInTheDocument();
  });
});
