import {useRef, useState} from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {render, TestHost} from '../test/render';
import {focusFirstInvalid, useWizard, WizardProgress, WizardStepper, type WizardErrors, type WizardStep} from './index';

type Id = 'kind' | 'details' | 'extra' | 'review';
interface Data {kind: string; name: string; network: boolean}
const all: WizardStep<Id>[] = [{id: 'kind', title: 'Kind', caption: 'What you run'}, {id: 'details', title: 'Details'}, {id: 'extra', title: 'Extra'}, {id: 'review', title: 'Review'}];
const validate = (id: Id, data: Data): WizardErrors => id === 'kind' && !data.kind ? {kind: 'Choose a kind'} : id === 'details' && !data.name ? {name: 'Enter a name'} : {};

function Harness({onEnter, initial}: {onEnter?: (id: Id) => void; initial?: {current?: Id; completed?: Id[]; reached?: Id[]}}) {
  const [data, setData] = useState<Data>({kind: '', name: '', network: false});
  const steps = all.filter(step => step.id !== 'extra' || data.network);
  const wizard = useWizard({steps, data, validate, onEnter, initial});
  const form = useRef<HTMLDivElement>(null);
  return <div ref={form}>
    <WizardStepper label="Steps" steps={wizard.steps} current={wizard.current} completed={wizard.completed} reachable={wizard.reached} onJump={id => wizard.jump(id)}/>
    <WizardProgress label="Progress" value={wizard.progress}/>
    <h1>{wizard.step.title}</h1>
    <output data-testid="errors">{JSON.stringify(wizard.errors)}</output><output data-testid="failures">{wizard.failures}</output>
    <input aria-label="Kind" value={data.kind} aria-invalid={!!wizard.errors.kind || undefined} onChange={event => setData(value => ({...value, kind: event.target.value}))}/>
    <input aria-label="Name" value={data.name} aria-invalid={!!wizard.errors.name || undefined} onChange={event => setData(value => ({...value, name: event.target.value}))}/>
    <button onClick={() => setData(value => ({...value, network: !value.network}))}>Network</button>
    <button onClick={() => {if (!wizard.next()) requestAnimationFrame(() => focusFirstInvalid(form.current, true));}}>Continue</button>
    <button onClick={wizard.back}>Back</button>
    <button onClick={() => {const bad = wizard.firstInvalid(); if (bad) {wizard.goTo(bad.id); wizard.fail(bad.errors);} else wizard.completeAll();}}>Submit</button>
  </div>;
}

test('validates before moving forward and clears errors as values are fixed', async () => {
  render(<Harness/>);
  fireEvent.click(screen.getByRole('button', {name: 'Continue'}));
  expect(screen.getByTestId('errors')).toHaveTextContent('Choose a kind');
  expect(screen.getByTestId('failures')).toHaveTextContent('1');
  await waitFor(() => expect(screen.getByRole('textbox', {name: 'Kind'})).toHaveFocus());
  fireEvent.change(screen.getByRole('textbox', {name: 'Kind'}), {target: {value: 'clinic'}});
  expect(screen.getByTestId('errors')).toHaveTextContent('{}');
  fireEvent.click(screen.getByRole('button', {name: 'Continue'}));
  expect(screen.getByRole('heading', {name: 'Details'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: /Kind \(completed\)/})).toBeEnabled();
  expect(screen.getByRole('button', {name: /Details/})).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('progressbar', {name: 'Progress'})).toHaveAttribute('aria-valuenow', '33');
});

test('forward jumps validate, backward jumps are free and unreached steps are refused', () => {
  const onEnter = vi.fn();
  render(<Harness onEnter={onEnter}/>);
  fireEvent.change(screen.getByRole('textbox', {name: 'Kind'}), {target: {value: 'lab'}});
  fireEvent.click(screen.getByRole('button', {name: 'Continue'}));
  expect(onEnter).toHaveBeenLastCalledWith('details');
  expect(screen.getByRole('button', {name: /Review/})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name: /Kind/}));
  expect(screen.getByRole('heading', {name: 'Kind'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: /Details/}));
  expect(screen.getByRole('heading', {name: 'Details'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Back'}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Kind'}), {target: {value: ''}});
  fireEvent.click(screen.getByRole('button', {name: /Details/}));
  expect(screen.getByRole('heading', {name: 'Kind'})).toBeInTheDocument();
  expect(screen.getByTestId('errors')).toHaveTextContent('Choose a kind');
});

test('data-dependent steps appear in order and submission returns to the first invalid step', () => {
  render(<Harness initial={{current: 'review', completed: ['kind'], reached: ['details', 'review', 'unknown' as Id]}}/>);
  expect(screen.getByRole('heading', {name: 'Review'})).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: /Extra/})).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Network'}));
  expect(screen.getAllByRole('listitem').map(item => item.getAttribute('data-step'))).toEqual(['kind', 'details', 'extra', 'review']);
  fireEvent.click(screen.getByRole('button', {name: 'Submit'}));
  expect(screen.getByRole('heading', {name: 'Kind'})).toBeInTheDocument();
  expect(screen.getByTestId('errors')).toHaveTextContent('Choose a kind');
});

test('stepper is read-only without reachable steps, follows reduced motion and renders in RTL', async () => {
  const jump = vi.fn();
  const view = render(<TestHost preferences={{reducedMotion: true, language: 'ar'}}><div dir="rtl">
    <WizardStepper label="Steps" steps={all} current={null} completed={new Set(all.map(step => step.id))} reachable={new Set()} onJump={jump}/>
    <WizardProgress label="Progress" value={1}/>
  </div></TestHost>);
  for (const button of screen.getAllByRole('button')) {expect(button).toBeDisabled(); expect(button.className).toContain('transition-none');}
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(view.container.querySelector('[data-wizard-progress] > div')!.className).not.toContain('transition');
  await act(async () => {fireEvent.click(screen.getAllByRole('button')[0]!);});
  expect(jump).not.toHaveBeenCalled();
});
