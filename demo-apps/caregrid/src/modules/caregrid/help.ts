import type {ShellTours, TourStep} from '@pepbits/shell';

/** Source page help. `anchors[i]` is the data-tour target that step i spotlights in the shell helper. */
export interface HelpEntry {title: string; intro: string; steps: string[]; anchors: string[]; tips?: string}
export const HELP: Record<string, HelpEntry> = {
  'caregrid-dashboard': {
    title: 'Command center', intro: 'A live picture of today: how busy each kind of resource is, what needs a decision, and who is next.',
    steps: ['Check the "Needs a decision" panel first. Anything there affects patients today or tomorrow.', 'Click a number in the top strip to jump to the list behind it.', 'The hourly chart shows arrivals per hour; the highlighted bar is now.', 'Busiest resources tells you where a delay will spread fastest.'],
    anchors: ['cg-decisions', 'cg-kpis', 'cg-arrivals', 'cg-busiest'],
    tips: 'Everything on this page refreshes by itself when anyone books, moves or blocks something.',
  },
  'caregrid-book': {
    title: 'Book an appointment', intro: 'Four clicks: patient, service, time, book. CareGrid checks every person, machine, room, chair, bed and vehicle the service needs, minute by minute.',
    steps: ['Find the patient by name, MRN or phone, or add a new one.', 'Pick a service. Type a few letters or tap a category.', 'Choose a day in the strip, then a time. "Next available" jumps straight to the earliest slot.', 'Review the resources reserved for you, add a note, and press Book.'],
    anchors: ['cg-book-patient', 'cg-book-service', 'cg-book-time', 'cg-book-confirm'],
    tips: 'For courses such as dialysis or physiotherapy, switch on "Repeat" to book every session at once. If nothing fits, add the patient to the waitlist and you will be alerted when a slot frees up.',
  },
  'caregrid-schedule': {
    title: 'Schedule board', intro: 'Every resource as a row, every booking as a block. Shaded areas are working hours; red hatching is a block such as leave or a breakdown.',
    steps: ['Choose a day and filter by department or resource type.', 'Click a booking to see details, check the patient in, move or cancel it.', 'Click inside working hours on an empty row, or use the row’s add button, to book that resource at that time.', 'Amber hatching marks reserved urgent time; dotted green marks walk-in time.'],
    anchors: ['cg-schedule-filters', 'cg-schedule-board', 'cg-schedule-board', 'cg-schedule-legend'],
  },
  'caregrid-frontdesk': {
    title: 'Front desk', intro: 'Today’s patient flow from arrival to completion, with one button per step.',
    steps: ['Check in patients as they arrive. The timer shows how long they have waited.', 'Start and complete sessions to capture real durations. These feed slot-length advice in Insights.', 'Mark no-shows to release the resources immediately.', 'Use the Waitlist tab to offer freed slots and the Reminders tab to see messages going out.'],
    anchors: ['cg-flow', 'cg-flow', 'cg-flow', 'cg-frontdesk-tabs'],
  },
  'caregrid-exceptions': {
    title: 'Availability and blocks', intro: 'Record leave, maintenance and breakdowns once. CareGrid finds every affected booking and suggests new times so nobody has to check calendars daily.',
    steps: ['Add a block: choose the resource, the reason and the time. Repeat it weekly for planned maintenance.', 'Before saving, review the impact list showing who will be affected.', 'Work through the reschedule queue: open options and move with one click, or press "Fix all automatically".', 'Add facility holidays to close elective services; 24x7 services keep running.'],
    anchors: ['cg-block', 'cg-impact', 'cg-queue', 'cg-holidays'],
    tips: 'Leave from HR rosters and maintenance plans can be fed in automatically through the same API.',
  },
  'caregrid-resources': {
    title: 'Resources', intro: 'People, machines, rooms, chairs, beds and vehicles, each with its own weekly working pattern.',
    steps: ['Select a resource to see its week, its blocks and which services use it.', 'Edit working hours per weekday. Use "Copy Monday to weekdays" to save time.', 'Mark windows as reserved for urgent or walk-in use and set when they open to everyone.', 'Save. Any booking that falls outside the new hours goes to the reschedule queue.'],
    anchors: ['cg-resource-list', 'cg-hours', 'cg-hours', 'cg-hours-save'],
  },
  'caregrid-catalog': {
    title: 'Service catalog', intro: 'All appointment types with the exact resources each one needs and for which minutes.',
    steps: ['Filter by category or search by name.', 'Open a service to see its resource segments, slot model and rules.', 'Adjust duration, start-time step, notice period or allowed start window.', 'Changes apply to new bookings only.'],
    anchors: ['cg-catalog-filters', 'cg-catalog-list', 'cg-catalog-list', 'cg-catalog-list'],
  },
  'caregrid-patients': {
    title: 'Patients', intro: 'Demo patient records with their appointments, waitlist entries and support needs.',
    steps: ['Search by name, MRN or phone.', 'Open a patient to see upcoming and past visits.', 'Book directly from the profile.'],
    anchors: ['cg-patient-search', 'cg-patient-profile', 'cg-patient-book'],
  },
  'caregrid-pharmacy': {
    title: 'Pharmacy desk', intro: 'Pickups, refills, counseling, INR checks, deliveries and compounding in one view.',
    steps: ['Watch the counter load for the day.', 'Check patients in and complete pickups.', 'Book refills, INR checks or home deliveries in one click.'],
    anchors: ['cg-counters', 'cg-pharmacy-queue', 'cg-pharmacy-book'],
  },
  'caregrid-insights': {
    title: 'Insights', intro: 'Use real timestamps to tune slot lengths and spot overloaded or idle resources.',
    steps: ['Duration advice compares planned length with what actually happens (median and 75th percentile).', 'Apply a suggested length with one click when a service keeps overrunning or finishing early.', 'Utilization shows booked versus available minutes per resource for any day.'],
    anchors: ['cg-insights-tabs', 'cg-insights-body', 'cg-insights-tabs'],
    tips: 'The 75th percentile is used rather than the average so a few very long visits do not inflate every slot.',
  },
  'caregrid-help': {title: 'Help center', intro: 'Guides, concepts and shortcuts for CareGrid.', steps: ['Search topics or browse the sections.'], anchors: ['cg-help-search']},
};
export const CONCEPTS = [
  {id: 'layers', title: 'How free time is calculated', body: [
    'CareGrid never stores empty slots. It works out free time the moment you ask, so it is always current.',
    'It starts from each resource’s weekly working hours, removes facility holidays (24x7 resources keep running), removes blocks such as leave or maintenance, then removes time already held by bookings, including cleaning, reprocessing and travel buffers.',
    'A time is offered only when every resource the service needs is free for its own minutes, the patient has no clash, and the service’s own rules allow it: notice period, earliest and latest start, and how far ahead it can be booked.']},
  {id: 'segments', title: 'Multi-resource appointments', body: [
    'Each service lists the resources it needs and for which minutes. A CT with contrast holds the prep bay and a nurse for the first 15 minutes, then the scanner, radiographer and radiologist. The scanner is free for someone else during prep.',
    'Segments can start before the patient arrives (chemotherapy drug preparation) or continue after they leave (a Holter recorder is out with the patient for 24 hours).',
    'When the same role appears twice, two different people or rooms are reserved, for example two surgical teams for a transplant.']},
  {id: 'exceptions', title: 'Exceptions without daily checking', body: [
    'Record leave, training, maintenance or a breakdown once, either by hand or automatically from HR rosters and the maintenance system.',
    'Before saving, you see exactly which booked patients would be affected. On saving, they move to the reschedule queue with the closest alternatives, preferring the same team.',
    'Use “Fix all automatically” to move everyone to their best alternative in one step, or decide case by case.']},
  {id: 'reserved', title: 'Reserved urgent and walk-in time', body: [
    'Part of a working window can be held back for urgent cases or walk-ins. Routine bookings cannot use it until a set number of hours before, after which it opens to everyone so it is not wasted.',
    'Urgent bookings can always use reserved time.']},
  {id: 'tuning', title: 'Choosing the right slot length', body: [
    'Every check-in, start and finish is time-stamped at the front desk. Insights compares planned length with the median and 75th percentile of what actually happens.',
    'The 75th percentile is used because averages are pulled up by a few long cases and down by quick ones. A slot sized at the 75th percentile fits three visits out of four without running late.',
    'Apply a suggestion with one click. Existing bookings keep their times; new bookings use the new length.']},
  {id: 'courses', title: 'Courses, waitlist and reminders', body: [
    'Repeat bookings create a whole course (dialysis three times a week, ten physiotherapy sessions). If the preferred time is taken on a day, the nearest free time is used and the same team is kept where possible.',
    'When nothing fits, add the patient to the waitlist. When a matching slot is cancelled, the first waitlisted patient is offered it and you are alerted.',
    'Reminders go out by the patient’s preferred channel 24 hours and 2 hours before, including preparation instructions such as fasting.']},
];
/** Contextual help for the shell helper; instructions sharing an anchor become one spotlight step. */
export function caregridTours(): ShellTours {
  return Object.fromEntries(Object.entries(HELP).map(([pageId, entry]) => {
    const steps: TourStep[] = [];
    entry.steps.forEach((text, index) => {
      const target = entry.anchors[index] ?? 'cg-page', existing = steps.find(step => step.target === target);
      if (existing) existing.text += ' ' + text; else steps.push({target, title: entry.title, text});
    });
    return [pageId, steps];
  }));
}
