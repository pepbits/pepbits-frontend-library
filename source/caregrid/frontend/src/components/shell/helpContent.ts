export interface HelpEntry { title: string; intro: string; steps: string[]; tips?: string }
export const HELP: Record<string, HelpEntry> = {
  '/': {
    title: 'Command center',
    intro: 'A live picture of today: how busy each kind of resource is, what needs a decision, and who is next.',
    steps: [
      'Check the "Needs a decision" panel first. Anything there affects patients today or tomorrow.',
      'Click a number in the top strip to jump to the list behind it.',
      'The hourly chart shows arrivals per hour; the amber line is now.',
      'Busiest resources tells you where a delay will spread fastest.',
    ],
    tips: 'Everything on this page refreshes by itself when anyone books, moves or blocks something.',
  },
  '/book': {
    title: 'Book an appointment',
    intro: 'Four clicks: patient, service, time, book. CareGrid checks every person, machine, room, chair, bed and vehicle the service needs, minute by minute.',
    steps: [
      'Find the patient by name, MRN or phone, or add a new one.',
      'Pick a service. Type a few letters or tap a category.',
      'Choose a day in the strip, then a time. "Next available" jumps straight to the earliest slot.',
      'Review the resources reserved for you, add a note, and press Book.',
    ],
    tips: 'For courses such as dialysis or physiotherapy, switch on "Repeat" to book every session at once. If nothing fits, add the patient to the waitlist and you will be alerted when a slot frees up.',
  },
  '/schedule': {
    title: 'Schedule board',
    intro: 'Every resource as a row, every booking as a block. Shaded areas are working hours; red hatching is a block such as leave or a breakdown.',
    steps: [
      'Choose a day and filter by department or resource type.',
      'Click a booking to see details, check the patient in, move or cancel it.',
      'Click inside working hours on an empty row to book that resource at that time.',
      'Amber hatching marks reserved urgent time; dotted green marks walk-in time.',
    ],
  },
  '/frontdesk': {
    title: 'Front desk',
    intro: 'Today’s patient flow from arrival to completion, with one button per step.',
    steps: [
      'Check in patients as they arrive. The timer shows how long they have waited.',
      'Start and complete sessions to capture real durations. These feed slot-length advice in Insights.',
      'Mark no-shows to release the resources immediately.',
      'Use the Waitlist tab to offer freed slots and the Reminders tab to see messages going out.',
    ],
  },
  '/exceptions': {
    title: 'Availability and blocks',
    intro: 'Record leave, maintenance and breakdowns once. CareGrid finds every affected booking and suggests new times so nobody has to check calendars daily.',
    steps: [
      'Add a block: choose the resource, the reason and the time. Repeat it weekly for planned maintenance.',
      'Before saving, review the impact list showing who will be affected.',
      'Work through the reschedule queue: open options and move with one click, or press "Fix all automatically".',
      'Add facility holidays to close elective services; 24x7 services keep running.',
    ],
    tips: 'Leave from HR rosters and maintenance plans can be fed in automatically through the same API.',
  },
  '/resources': {
    title: 'Resources',
    intro: 'People, machines, rooms, chairs, beds and vehicles, each with its own weekly working pattern.',
    steps: [
      'Select a resource to see its week, its blocks and which services use it.',
      'Edit working hours per weekday. Use "Copy Monday to weekdays" to save time.',
      'Mark windows as reserved for urgent or walk-in use and set when they open to everyone.',
      'Save. Any booking that falls outside the new hours goes to the reschedule queue.',
    ],
  },
  '/catalog': {
    title: 'Service catalog',
    intro: 'All appointment types with the exact resources each one needs and for which minutes.',
    steps: [
      'Filter by category or search by name.',
      'Open a service to see its resource segments, slot model and rules.',
      'Adjust duration, start-time step, notice period or allowed start window.',
      'Changes apply to new bookings only.',
    ],
  },
  '/patients': {
    title: 'Patients',
    intro: 'Demo patient records with their appointments, waitlist entries and support needs.',
    steps: ['Search by name, MRN or phone.', 'Open a patient to see upcoming and past visits.', 'Book directly from the profile.'],
  },
  '/pharmacy': {
    title: 'Pharmacy desk',
    intro: 'Pickups, refills, counseling, INR checks, deliveries and compounding in one view.',
    steps: ['Watch the counter load for the day.', 'Check patients in and complete pickups.', 'Book refills, INR checks or home deliveries in one click.'],
  },
  '/insights': {
    title: 'Insights',
    intro: 'Use real timestamps to tune slot lengths and spot overloaded or idle resources.',
    steps: [
      'Duration advice compares planned length with what actually happens (median and 75th percentile).',
      'Apply a suggested length with one click when a service keeps overrunning or finishing early.',
      'Utilization shows booked versus available minutes per resource for any day.',
    ],
    tips: 'The 75th percentile is used rather than the average so a few very long visits do not inflate every slot.',
  },
  '/help': { title: 'Help center', intro: 'Guides, concepts and shortcuts for CareGrid.', steps: ['Search topics or browse the sections.'] },
};
