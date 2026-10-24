import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ReferenceReportsModule} from './module';
import {SYSTEM_REPORT_DESTINATIONS} from './routes';
import {LONG, render, storeHost} from '../../test/module-host';

describe('every system report destination', () => {
  it.each(SYSTEM_REPORT_DESTINATIONS.map(([id, title]) => [id, title]))('%s runs on screen or offers the background path', async (id, title) => {
    const setup = storeHost('/reports/' + id);
    const {container} = render(<ReferenceReportsModule path={'/reports/' + id} host={setup.host}/>);
    expect(await screen.findByRole('heading', {name: title, level: 1}, LONG)).toBeInTheDocument();
    await waitFor(() => expect(setup.calls.some(call => call.path === `/api/reports/${id}/run`)).toBe(true), LONG);
    await waitFor(() => expect(container.querySelector('tbody tr:not(:has(.lr-table-empty))') ?? screen.queryByText('This request is too large to show on screen')).toBeTruthy(), LONG);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
