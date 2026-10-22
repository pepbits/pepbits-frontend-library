import React from 'react';
import {render, screen} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {TestHost} from '../test/render';
import {EMPTY_PREFERENCE_POLICY} from '@pepbits/preferences';
import {DcpRuntimeFields} from './runtime-fields';
import type {DcpRuntimeField, DcpRuntimeView} from './contract';

test('read-only numbers and dates follow effective format preferences while editable ISO values stay unchanged', () => {
  const field = (code: string, type: DcpRuntimeField['type'], writable = false): DcpRuntimeField => ({code, type, label: code,
    required: false, writable, masked: false, maxLength: 100, minimum: null, maximum: null, options: [], children: [], maxItems: 0});
  const view: DcpRuntimeView = {contractVersion: 1, label: 'Sample', definitionVersion: 1, checksum: 'sample', sections: [], values: {}, violations: [], rowFields: {}};
  const content = <DcpRuntimeFields fields={[field('quantity', 'DECIMAL'), field('date', 'DATE'), field('editable', 'DATE', true)]}
    values={{quantity: 1234.567, date: '2026-10-22', editable: '2026-10-22'}} view={view} change={vi.fn()}/>;
  const {rerender} = render(<TestHost preferences={{numberLocale: 'en-US', decimalPlaces: 2, dateFormat: 'iso'}}>{content}</TestHost>);
  expect(screen.getByText('1,234.57')).toBeInTheDocument();
  expect(screen.getByText('2026-10-22')).toBeInTheDocument();
  expect(screen.getByLabelText('editable')).toHaveValue('2026-10-22');
  rerender(<TestHost preferences={{numberLocale: 'en-US', decimalPlaces: 2, dateFormat: 'iso'}}
    preferencePolicy={{...EMPTY_PREFERENCE_POLICY, rules: {decimalPlaces: {locked: true, value: 0}, dateFormat: {locked: true, value: 'dmy'}}}}>{content}</TestHost>);
  expect(screen.getByText('1,235')).toBeInTheDocument();
  expect(screen.getByText('22/10/2026')).toBeInTheDocument();
  expect(screen.getByLabelText('editable')).toHaveValue('2026-10-22');
});
