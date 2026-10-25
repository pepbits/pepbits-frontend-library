import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceSchoolStore } from './reference-school-store.mjs';

const scope = { applicationId: 'app-1', branchId: 'br-1' };
const hostUser = (role, extra) => ({ id: 'host-user', name: 'Host User', email: 'host@x.com', role, branch: 'br-1', tenantId: 't-1', ...extra });
const req = (extra) => ({ method: 'GET', path: '/', query: {}, body: undefined, ...extra });

function session(store, role) {
  return store.handle(hostUser(role), scope, req({ path: '/session', query: { role } })).body.data;
}

test('session resolves a fixed fictional identity per role and rejects a role the user does not hold', () => {
  const store = createReferenceSchoolStore();
  const admin = session(store, 'admin');
  assert.equal(admin.role, 'admin');
  assert.ok(admin.user.id && admin.user.name && admin.user.title && admin.user.email);
  const parent = session(store, 'parent');
  assert.deepEqual(parent.children.sort(), ['s-1072', 's-1192']);
  const student = session(store, 'student');
  assert.equal(student.children.length, 0);

  const mismatch = store.handle(hostUser('teacher'), scope, req({ path: '/session', query: { role: 'admin' } }));
  assert.equal(mismatch.status, 403);

  const aliased = store.handle(hostUser('enterprise-admin'), scope, req({ path: '/session', query: { role: 'admin' } }));
  assert.equal(aliased.status, 200);
  assert.equal(aliased.body.data.role, 'admin');

  const unknownRole = store.handle(hostUser('some-other-role'), scope, req({ path: '/session' }));
  assert.equal(unknownRole.status, 403);
});

test('generic resource list envelope {data,total}, filter, q, pagination', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const all = store.handle(admin, scope, req({ path: '/api/students', query: { pageSize: '5', page: '1' } }));
  assert.equal(all.status, 200);
  assert.ok(Array.isArray(all.body.data));
  assert.equal(all.body.data.length, 5);
  assert.equal(all.body.total, 336);

  const teachers = store.handle(admin, scope, req({ path: '/teachers' }));
  assert.equal(teachers.body.total, 34);

  const filtered = store.handle(admin, scope, req({ path: '/students', query: { classId: 'c-10A' } }));
  assert.ok(filtered.body.data.every((s) => s.classId === 'c-10A'));

  const q = store.handle(admin, scope, req({ path: '/students', query: { q: 'elena vasquez' } }));
  assert.equal(q.body.data.length, 1);
  assert.equal(q.body.data[0].id, 's-1192');
});

test('CRUD round trip: students, invoices (payAmount), issues (return), delete', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const created = store.handle(admin, scope, req({ method: 'POST', path: '/students', body: { name: 'New Student', classId: 'c-6A', gender: 'Female' } }));
  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, 'Active');
  assert.ok(created.body.data.admissionNo.startsWith('NB/'));

  const got = store.handle(admin, scope, req({ path: `/students/${created.body.data.id}` }));
  assert.equal(got.status, 200);
  assert.equal(got.body.data.name, 'New Student');

  const patched = store.handle(admin, scope, req({ method: 'PATCH', path: `/students/${created.body.data.id}`, body: { house: 'Everest' } }));
  assert.equal(patched.body.data.house, 'Everest');

  const invoices = store.handle(admin, scope, req({ path: '/invoices', query: { studentId: created.body.data.id === 's-1192' ? '' : undefined } }));
  const anyInvoice = store.handle(admin, scope, req({ path: '/invoices', query: { pageSize: '1' } })).body.data[0];
  const pay = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${anyInvoice.id}`, body: { payAmount: anyInvoice.amount - anyInvoice.paid, method: 'Card' } }));
  assert.equal(pay.status, 200);
  assert.ok(pay.body.data.paid <= pay.body.data.amount);

  const deleted = store.handle(admin, scope, req({ method: 'DELETE', path: `/students/${created.body.data.id}` }));
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.data.id, created.body.data.id);
  const gone = store.handle(admin, scope, req({ path: `/students/${created.body.data.id}` }));
  assert.equal(gone.status, 404);
});

test('library last-copy conflict on issues create', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const books = store.handle(admin, scope, req({ path: '/books', query: { pageSize: '500' } })).body.data;
  const book = books.find((b) => b.available > 0);
  const initialAvailable = book.available;
  let lastResult;
  for (let i = 0; i < initialAvailable; i++) {
    lastResult = store.handle(admin, scope, req({ method: 'POST', path: '/issues', body: { bookId: book.id, memberId: 's-1192', memberName: 'Elena Vasquez', memberType: 'Student', issuedOn: '2026-01-01', dueOn: '2026-01-15' } }));
    assert.equal(lastResult.status, 201);
  }
  const overIssue = store.handle(admin, scope, req({ method: 'POST', path: '/issues', body: { bookId: book.id, memberId: 's-1072', memberName: 'Mateo Vasquez', memberType: 'Student', issuedOn: '2026-01-01', dueOn: '2026-01-15' } }));
  assert.equal(overIssue.status, 409);
});

test('meta is unwrapped; attendance/marks/report-card/stats use their documented envelopes', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const meta = store.handle(admin, scope, req({ path: '/meta' }));
  assert.equal(meta.status, 200);
  assert.ok(Array.isArray(meta.body.periods));
  assert.ok(Array.isArray(meta.body.terms));
  assert.ok('data' in meta.body === false);

  const attendance = store.handle(admin, scope, req({ path: '/attendance', query: { classId: 'c-10A' } }));
  assert.equal(attendance.status, 200);
  assert.ok(Array.isArray(attendance.body.data));
  assert.ok(typeof attendance.body.taken === 'boolean');
  assert.ok(Array.isArray(attendance.body.trend));

  const marks = store.handle(admin, scope, req({ path: '/marks', query: { classId: 'c-10A', term: 'QTR' } }));
  assert.equal(marks.status, 200);
  assert.ok(marks.body.data.class && marks.body.data.term && Array.isArray(marks.body.data.students));

  const reportCard = store.handle(admin, scope, req({ path: '/report-card', query: { studentId: 's-1192' } }));
  assert.equal(reportCard.status, 200);
  assert.ok(reportCard.body.data.student && Array.isArray(reportCard.body.data.terms));

  const stats = store.handle(admin, scope, req({ path: '/stats', query: { role: 'admin' } }));
  assert.equal(stats.status, 200);
  assert.ok(typeof stats.body.data.students === 'number');
});

test('branch and tenant isolation', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const created = store.handle(admin, scope, req({ method: 'POST', path: '/notices', body: { title: 'Only in branch 1', body: 'x', audience: 'All', priority: 'Normal', postedBy: 'Admin' } }));
  assert.equal(created.status, 201);
  const otherBranch = store.handle({ ...admin, branch: 'br-2' }, { applicationId: 'app-1', branchId: 'br-2' }, req({ path: '/notices', query: { q: 'only in branch 1' } }));
  assert.equal(otherBranch.body.data.length, 0);
  const otherTenant = store.handle({ ...admin, tenantId: 't-2' }, scope, req({ path: '/notices', query: { q: 'only in branch 1' } }));
  assert.equal(otherTenant.body.data.length, 0);
});

test('wrong-branch and missing-identity denial', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const mismatched = store.handle(admin, { applicationId: 'app-1', branchId: 'br-9' }, req({ path: '/students' }));
  assert.equal(mismatched.status, 403);
  const noTenant = store.handle({ ...admin, tenantId: '' }, scope, req({ path: '/students' }));
  assert.equal(noTenant.status, 400);
});

test('role scoping: student sees only own record/fee/attendance; parent sees only own children', () => {
  const store = createReferenceSchoolStore();
  const student = hostUser('student');
  const parent = hostUser('parent');

  const studentsList = store.handle(student, scope, req({ path: '/students' }));
  assert.equal(studentsList.body.data.length, 1);
  assert.equal(studentsList.body.data[0].id, 's-1192');

  const studentInvoices = store.handle(student, scope, req({ path: '/invoices' }));
  assert.ok(studentInvoices.body.data.every((i) => i.studentId === 's-1192'));

  const parentStudents = store.handle(parent, scope, req({ path: '/students' }));
  assert.deepEqual(parentStudents.body.data.map((s) => s.id).sort(), ['s-1072', 's-1192']);

  const otherStudent = store.handle(student, scope, req({ path: '/report-card', query: { studentId: 's-1072' } }));
  assert.equal(otherStudent.status, 403);
  const ownReportCard = store.handle(student, scope, req({ path: '/report-card', query: { studentId: 's-1192' } }));
  assert.equal(ownReportCard.status, 200);
  const parentChildReportCard = store.handle(parent, scope, req({ path: '/report-card', query: { studentId: 's-1072' } }));
  assert.equal(parentChildReportCard.status, 200);
});

test('teacher academic writes are limited to their own assigned classes/records', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher');
  const homeAttendance = store.handle(teacher, scope, req({ method: 'POST', path: '/attendance', body: { date: '2026-09-01', rows: [{ studentId: 's-1192', status: 'P' }] } }));
  assert.equal(homeAttendance.status, 200);

  const outsideStudent = store.handle(teacher, scope, req({ path: '/students' })).body;
  const admin = hostUser('admin');
  const otherClassStudent = store.handle(admin, scope, req({ path: '/students', query: { classId: 'c-7A', pageSize: '1' } })).body.data[0];
  const deniedAttendance = store.handle(teacher, scope, req({ method: 'POST', path: '/attendance', body: { date: '2026-09-01', rows: [{ studentId: otherClassStudent.id, status: 'P' }] } }));
  assert.equal(deniedAttendance.status, 403);

  const masterEdit = store.handle(teacher, scope, req({ method: 'PATCH', path: '/students/s-1192', body: { house: 'Alps' } }));
  assert.equal(masterEdit.status, 403);

  const invoiceEdit = store.handle(teacher, scope, req({ method: 'PATCH', path: '/invoices/inv-1', body: { payAmount: 10 } }));
  assert.equal(invoiceEdit.status, 403);
});

test('accountant is restricted to fees; librarian to books/issues', () => {
  const store = createReferenceSchoolStore();
  const accountant = hostUser('accountant');
  const invoices = store.handle(accountant, scope, req({ path: '/invoices', query: { pageSize: '500' } })).body.data;
  const invoice = invoices.find((i) => i.amount - i.paid >= 1);
  const pay = store.handle(accountant, scope, req({ method: 'PATCH', path: `/invoices/${invoice.id}`, body: { payAmount: 1 } }));
  assert.equal(pay.status, 200);
  const accountantWritesStudent = store.handle(accountant, scope, req({ method: 'PATCH', path: '/students/s-1192', body: { house: 'Alps' } }));
  assert.equal(accountantWritesStudent.status, 403);

  const librarian = hostUser('librarian');
  const books = store.handle(librarian, scope, req({ path: '/books', query: { page: '1', pageSize: '1' } })).body.data;
  assert.equal(books.length, 1);
  const bookPatch = store.handle(librarian, scope, req({ method: 'PATCH', path: `/books/${books[0].id}`, body: { rating: 5 } }));
  assert.equal(bookPatch.status, 200);
  assert.equal(bookPatch.body.data.rating, books[0].rating); // rating is server-owned and is never client-settable via PATCH
  const librarianWritesInvoice = store.handle(librarian, scope, req({ method: 'PATCH', path: '/invoices/inv-1', body: { payAmount: 1 } }));
  assert.equal(librarianWritesInvoice.status, 403);
});

test('quiz attempts: student-only, scored server-side, one attempt, denies a second submission', () => {
  const store = createReferenceSchoolStore();
  const student = hostUser('student');
  const quiz = store.handle(hostUser('admin'), scope, req({ path: '/quizzes', query: { classId: 'c-10A', pageSize: '1' } })).body.data[0];
  const answers = quiz.questions.map((q) => q.answer);
  const submit = store.handle(student, scope, req({ method: 'POST', path: '/quiz-attempts', body: { quizId: quiz.id, answers, timeTaken: 120 } }));
  assert.equal(submit.status, 201);
  assert.equal(submit.body.data.score, quiz.questions.reduce((s, q) => s + q.points, 0));
  const again = store.handle(student, scope, req({ method: 'POST', path: '/quiz-attempts', body: { quizId: quiz.id, answers, timeTaken: 60 } }));
  assert.equal(again.status, 409);
  const teacherAttempt = store.handle(hostUser('teacher'), scope, req({ method: 'POST', path: '/quiz-attempts', body: { quizId: quiz.id, answers } }));
  assert.equal(teacherAttempt.status, 403);
  const get = store.handle(student, scope, req({ path: '/quiz-attempts', query: { quizId: quiz.id } }));
  assert.equal(get.body.data.score, quiz.questions.reduce((s, q) => s + q.points, 0));
});

test('settings: get/patch profile, change password, delete a session', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const settings = store.handle(admin, scope, req({ path: '/settings' }));
  assert.equal(settings.status, 200);
  assert.ok(settings.body.data.profile.name);
  const patched = store.handle(admin, scope, req({ method: 'PATCH', path: '/settings', body: { profile: { phone: '+1 555 0000' } } }));
  assert.equal(patched.body.data.profile.phone, '+1 555 0000');
  const badPassword = store.handle(admin, scope, req({ method: 'POST', path: '/settings/password', body: { current: 'wrong', next: 'newpassword1', confirm: 'newpassword1' } }));
  assert.equal(badPassword.status, 403);
  const changed = store.handle(admin, scope, req({ method: 'POST', path: '/settings/password', body: { current: 'demo-password', next: 'newpassword1', confirm: 'newpassword1' } }));
  assert.equal(changed.status, 200);
  const revoked = store.handle(admin, scope, req({ method: 'DELETE', path: '/settings/sessions/session-current' }));
  assert.equal(revoked.status, 200);
});

test('malformed input never throws and returns structured 4xx', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  assert.doesNotThrow(() => store.handle(admin, scope, req({ path: '/not-a-resource' })));
  assert.equal(store.handle(admin, scope, req({ path: '/not-a-resource' })).status, 404);
  assert.equal(store.handle(admin, scope, req({ path: '/students', method: 'PUT' })).status, 405);
  assert.equal(store.handle(admin, scope, req({ path: '/students', method: 'POST', body: 'oops' })).status, 400);
  assert.equal(store.handle(admin, scope, req({ path: '/marks', method: 'POST', body: { term: 'QTR', entries: [{ studentId: 's-1000', subjectId: 'sub-math', value: 500 }] } })).status, 400);
  assert.equal(store.handle(admin, scope, req({ path: '/attendance' })).status, 400);
});

test('school profile, fee structure and contacts are readable reference data', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const profile = store.handle(admin, scope, req({ path: '/school-profile' }));
  assert.equal(profile.status, 200);
  assert.ok(profile.body.data.name && profile.body.data.bankTransfer);

  const fees = store.handle(admin, scope, req({ path: '/fee-structure' }));
  assert.equal(fees.status, 200);
  assert.deepEqual(fees.body.data.map((r) => r.g), [6, 7, 8, 9, 10, 11, 12]);
  assert.ok(fees.body.policy.siblingDiscountPct);

  const contacts = store.handle(hostUser('student'), scope, req({ path: '/contacts' }));
  assert.equal(contacts.status, 200);
  assert.ok(contacts.body.data.length > 0 && contacts.body.data.every((c) => c.name && c.role));
});

test('leave requests, reservations and fee reminders are scoped and validated', () => {
  const store = createReferenceSchoolStore();
  const student = hostUser('student');
  const parent = hostUser('parent');
  const librarian = hostUser('librarian');
  const accountant = hostUser('accountant');

  const ownLeave = store.handle(student, scope, req({ method: 'POST', path: '/leave-requests', body: { studentId: 's-1192', from: '2026-10-01', to: '2026-10-02', reason: 'Family trip' } }));
  assert.equal(ownLeave.status, 201);
  assert.ok(ownLeave.body.data.id);
  const otherLeave = store.handle(student, scope, req({ method: 'POST', path: '/leave-requests', body: { studentId: 's-1072', from: '2026-10-01', to: '2026-10-02', reason: 'x' } }));
  assert.equal(otherLeave.status, 403);
  const parentLeave = store.handle(parent, scope, req({ method: 'POST', path: '/leave-requests', body: { studentId: 's-1072', from: '2026-10-01', to: '2026-10-02', reason: 'Doctor visit' } }));
  assert.equal(parentLeave.status, 201);
  const librarianLeave = store.handle(librarian, scope, req({ method: 'POST', path: '/leave-requests', body: { studentId: 's-1192', from: '2026-10-01', to: '2026-10-02', reason: 'x' } }));
  assert.equal(librarianLeave.status, 403);
  const malformedLeave = store.handle(student, scope, req({ method: 'POST', path: '/leave-requests', body: { studentId: 's-1192' } }));
  assert.equal(malformedLeave.status, 400);

  const books = store.handle(hostUser('admin'), scope, req({ path: '/books', query: { pageSize: '1' } })).body.data[0];
  const ownReservation = store.handle(student, scope, req({ method: 'POST', path: '/reservations', body: { bookId: books.id, memberId: 's-1192' } }));
  assert.equal(ownReservation.status, 201);
  const impersonatedReservation = store.handle(student, scope, req({ method: 'POST', path: '/reservations', body: { bookId: books.id, memberId: 's-1072' } }));
  assert.equal(impersonatedReservation.status, 403);
  const accountantReservation = store.handle(accountant, scope, req({ method: 'POST', path: '/reservations', body: { bookId: books.id, memberId: 'u-acc' } }));
  assert.equal(accountantReservation.status, 403);
  const librarianOnBehalf = store.handle(librarian, scope, req({ method: 'POST', path: '/reservations', body: { bookId: books.id, memberId: 's-1192' } }));
  assert.equal(librarianOnBehalf.status, 201);

  const invoice = store.handle(hostUser('admin'), scope, req({ path: '/invoices', query: { pageSize: '1' } })).body.data[0];
  const reminders = store.handle(accountant, scope, req({ method: 'POST', path: '/invoices/reminders', body: { invoiceIds: [invoice.id, 'not-a-real-invoice'] } }));
  assert.equal(reminders.status, 200);
  assert.equal(reminders.body.data.sent, 1);
  const teacherReminders = store.handle(hostUser('teacher'), scope, req({ method: 'POST', path: '/invoices/reminders', body: { invoiceIds: [invoice.id] } }));
  assert.equal(teacherReminders.status, 403);
  const malformedReminders = store.handle(accountant, scope, req({ method: 'POST', path: '/invoices/reminders', body: { invoiceIds: 'nope' } }));
  assert.equal(malformedReminders.status, 400);
});

test('quiz answer privacy, server-side grading and idempotent replay', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const teacher = hostUser('teacher');
  const student = hostUser('student');
  const quizId = 'qz-33';
  const otherClassQuizId = 'qz-9';

  const listAsStudent = store.handle(student, scope, req({ path: '/quizzes', query: { classId: 'c-10A' } }));
  assert.ok(listAsStudent.body.data.every((q) => q.questions === undefined || q.questions.every((qq) => qq.answer === undefined && qq.explanation === undefined)));
  const itemAsStudent = store.handle(student, scope, req({ path: `/quizzes/${quizId}` }));
  assert.ok(itemAsStudent.body.data.questions.every((q) => q.answer === undefined));
  const itemAsTeacher = store.handle(teacher, scope, req({ path: `/quizzes/${quizId}` }));
  assert.ok(itemAsTeacher.body.data.questions.some((q) => q.answer !== undefined));

  const questionsAsStudent = store.handle(student, scope, req({ path: `/quizzes/${quizId}/questions` }));
  assert.equal(questionsAsStudent.status, 200);
  assert.ok(questionsAsStudent.body.data.every((q) => q.answer === undefined && q.explanation === undefined && q.text && Array.isArray(q.options)));
  const questionsAsTeacher = store.handle(teacher, scope, req({ path: `/quizzes/${quizId}/questions` }));
  assert.ok(questionsAsTeacher.body.data.every((q) => typeof q.answer === 'number'));

  const bankDenied = store.handle(student, scope, req({ path: '/question-bank', query: { subjectId: 'sub-math' } }));
  assert.equal(bankDenied.status, 403);
  const bank = store.handle(teacher, scope, req({ path: '/question-bank', query: { subjectId: 'sub-math' } }));
  assert.equal(bank.status, 200);
  assert.ok(bank.body.data.length > 0 && bank.body.data.every((q) => typeof q.answer === 'number'));

  const answers = questionsAsTeacher.body.data.map((q) => q.answer);
  const badLength = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${quizId}/grade`, body: { answers: answers.slice(1), timeTaken: 10 } }));
  assert.equal(badLength.status, 400);

  const staffWithoutPreview = store.handle(teacher, scope, req({ method: 'POST', path: `/quizzes/${quizId}/grade`, body: { answers, timeTaken: 10 } }));
  assert.equal(staffWithoutPreview.status, 403);
  const staffOtherClassPreview = store.handle(teacher, scope, req({ method: 'POST', path: `/quizzes/${otherClassQuizId}/grade`, body: { answers: [0, 0, 0, 0, 0, 0, 0, 0], timeTaken: 5, preview: true } }));
  assert.equal(staffOtherClassPreview.status, 403);
  const staffPreview = store.handle(teacher, scope, req({ method: 'POST', path: `/quizzes/${quizId}/grade`, body: { answers, timeTaken: 5, preview: true } }));
  assert.equal(staffPreview.status, 200);
  assert.equal(staffPreview.body.data.preview, true);
  assert.equal(staffPreview.body.data.score, staffPreview.body.data.total);

  const graded = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${quizId}/grade`, body: { answers, timeTaken: 90 } }));
  assert.equal(graded.status, 201);
  assert.equal(graded.body.data.score, graded.body.data.total);
  assert.ok(Array.isArray(graded.body.data.review) && graded.body.data.review.every((r) => typeof r.answer === 'number'));

  const replay = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${quizId}/grade`, body: { answers, timeTaken: 90 } }));
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.score, graded.body.data.score);

  const wrongAnswers = answers.map((a) => (a + 1) % 4);
  const conflicting = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${quizId}/grade`, body: { answers: wrongAnswers, timeTaken: 90 } }));
  assert.equal(conflicting.status, 409);

  const attemptsForStudent = store.handle(admin, scope, req({ path: '/quiz-attempts', query: { studentId: 's-1192' } }));
  assert.equal(attemptsForStudent.body.data.length, 1);
  const attemptsForOtherClassByTeacher = store.handle(teacher, scope, req({ path: '/quiz-attempts', query: { studentId: 's-1048' } }));
  assert.equal(attemptsForOtherClassByTeacher.status, 403);
  const attemptsForOwnChild = store.handle(hostUser('parent'), scope, req({ path: '/quiz-attempts', query: { studentId: 's-1072' } }));
  assert.equal(attemptsForOwnChild.status, 200);
  const attemptsForNonChild = store.handle(hostUser('parent'), scope, req({ path: '/quiz-attempts', query: { studentId: 's-1048' } }));
  assert.equal(attemptsForNonChild.status, 403);
});

test('live room: host-only privileges, class isolation, single vote per identity', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher');
  const student = hostUser('student');
  const admin = hostUser('admin');
  const ownLiveId = 'lv-32';
  const otherClassLiveId = 'lv-14';

  const deniedRoom = store.handle(teacher, scope, req({ path: `/live/${otherClassLiveId}/room` }));
  assert.equal(deniedRoom.status, 403);
  const deniedStudentRoom = store.handle(student, scope, req({ path: `/live/${otherClassLiveId}/room` }));
  assert.equal(deniedStudentRoom.status, 403);

  const hostRoom = store.handle(teacher, scope, req({ path: `/live/${ownLiveId}/room` }));
  assert.equal(hostRoom.status, 200);
  assert.ok(!hostRoom.body.data.people.some((p) => p.id === 't-001'));

  const studentPollLaunch = store.handle(student, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'poll-launch', index: 0, pollNumber: 1 } }));
  assert.equal(studentPollLaunch.status, 403);

  const launched = store.handle(teacher, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'poll-launch', index: 0, pollNumber: 1 } }));
  assert.equal(launched.status, 200);
  assert.ok(launched.body.data.poll.open);
  assert.equal(typeof launched.body.data.poll.answer, 'number');

  const studentBeforeClose = store.handle(student, scope, req({ path: `/live/${ownLiveId}/room` }));
  assert.equal(studentBeforeClose.body.data.poll.answer, undefined);

  const vote1 = store.handle(student, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'poll-vote', index: 0, pollNumber: 1 } }));
  assert.equal(vote1.status, 200);
  const revote = store.handle(student, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'poll-vote', index: 1, pollNumber: 1 } }));
  assert.equal(revote.status, 200);
  const totalVotes = revote.body.data.poll.votes.reduce((a, b) => a + b, 0);
  assert.equal(totalVotes, 1);
  assert.equal(revote.body.data.poll.votes[1], 1);
  assert.equal(revote.body.data.poll.mine, 1);

  const studentClose = store.handle(student, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'poll-close', pollNumber: 1 } }));
  assert.equal(studentClose.status, 403);
  const hostClose = store.handle(teacher, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'poll-close', pollNumber: 1 } }));
  assert.equal(hostClose.status, 200);
  assert.equal(hostClose.body.data.poll.open, false);
  assert.ok(typeof hostClose.body.data.poll.answer === 'number');

  const studentAfterClose = store.handle(student, scope, req({ path: `/live/${ownLiveId}/room` }));
  assert.ok(typeof studentAfterClose.body.data.poll.answer === 'number');

  const message = store.handle(student, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'message', text: 'Can you repeat that?' } }));
  assert.equal(message.status, 200);
  const seenByTeacher = store.handle(teacher, scope, req({ path: `/live/${ownLiveId}/room` }));
  assert.ok(seenByTeacher.body.data.messages.some((m) => m.text === 'Can you repeat that?' && m.me === undefined));

  const studentRecording = store.handle(student, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'recording', enabled: true } }));
  assert.equal(studentRecording.status, 403);
  const hostRecording = store.handle(teacher, scope, req({ method: 'POST', path: `/live/${ownLiveId}/actions`, body: { action: 'recording', enabled: true } }));
  assert.equal(hostRecording.status, 200);
  assert.equal(hostRecording.body.data.recording, true);

  const adminAlwaysAllowed = store.handle(admin, scope, req({ path: `/live/${otherClassLiveId}/room` }));
  assert.equal(adminAlwaysAllowed.status, 200);
});

test('newly canonical demo role aliases resolve to their school role; a query-role escalation is denied, a plain session is not', () => {
  const store = createReferenceSchoolStore();
  const canonical = { 'school-admin': 'admin', 'school-teacher': 'teacher', 'school-student': 'student', 'school-parent': 'parent', 'school-librarian': 'librarian', 'school-accountant': 'accountant' };
  for (const [hostRole, expected] of Object.entries(canonical)) {
    const plain = store.handle(hostUser(hostRole), scope, req({ path: '/session' }));
    assert.equal(plain.status, 200, hostRole);
    assert.equal(plain.body.data.role, expected, hostRole);
  }
  // an alternate frontend candidate form of the same alias (e.g. "school:teacher") resolves exactly like "teacher"
  const colonForm = store.handle(hostUser('school:teacher'), scope, req({ path: '/session', query: { role: 'teacher' } }));
  assert.equal(colonForm.status, 200);
  assert.equal(colonForm.body.data.role, 'teacher');

  // school-teacher may request only the role it actually holds; asking for one it does not is denied, in the query...
  const elevateQuery = store.handle(hostUser('school-teacher'), scope, req({ path: '/session', query: { role: 'admin' } }));
  assert.equal(elevateQuery.status, 403);
  // ...and the body is never authority (the session route never reads it), so a plain/no-hint session still resolves to teacher
  const elevateBody = store.handle(hostUser('school-teacher'), scope, req({ path: '/session', query: {}, body: { role: 'admin' } }));
  assert.equal(elevateBody.status, 200);
  assert.equal(elevateBody.body.data.role, 'teacher');
  const plainSession = store.handle(hostUser('school-teacher'), scope, req({ path: '/session' }));
  assert.equal(plainSession.status, 200);
  assert.equal(plainSession.body.data.role, 'teacher');
});

test('dashboard stats trends: admin and accountant carry the documented fixed demo values; other roles never fabricate one', () => {
  const store = createReferenceSchoolStore();
  const stats = store.handle(hostUser('admin'), scope, req({ path: '/stats', query: { role: 'admin' } }));
  assert.deepEqual(stats.body.data.trends, { students: 3.2, attendanceToday: 0.8 });

  const accStats = store.handle(hostUser('accountant'), scope, req({ path: '/stats', query: { role: 'accountant' } }));
  assert.deepEqual(accStats.body.data.trends, { collected: 4.1 });

  const teacherStats = store.handle(hostUser('teacher'), scope, req({ path: '/stats', query: { role: 'teacher' } }));
  assert.equal(teacherStats.body.data.trends, undefined);
  const studentStats = store.handle(hostUser('student'), scope, req({ path: '/stats', query: { role: 'student' } }));
  assert.equal(studentStats.body.data.trends, undefined);
});

test('invoice payment receipts: sequential per-scope numbers, honest receiptSent, atomic bounds preserved on negative/over-payment', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const invoices = store.handle(admin, scope, req({ path: '/invoices', query: { pageSize: '500' } })).body.data;
  const invoice = invoices.find((i) => i.amount - i.paid > 20);

  const negative = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${invoice.id}`, body: { payAmount: -5, method: 'Card' } }));
  assert.equal(negative.status, 400);
  const unchanged = store.handle(admin, scope, req({ path: `/invoices/${invoice.id}` })).body.data;
  assert.equal(unchanged.paid, invoice.paid);
  assert.equal(unchanged.receiptNo, undefined);

  const partialAmount = Math.max(1, Math.floor((invoice.amount - invoice.paid) / 2));
  const partial = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${invoice.id}`, body: { payAmount: partialAmount, method: 'Card' } }));
  assert.equal(partial.status, 200);
  assert.equal(partial.body.data.status, 'Partial');
  assert.ok(/^RCT-br-1-\d{6}$/.test(partial.body.data.receiptNo));
  assert.equal(partial.body.data.receiptSent, false); // not fully settled: never a false "emailed" claim
  const firstReceiptNo = partial.body.data.receiptNo;

  const remaining = partial.body.data.amount - partial.body.data.paid;
  const full = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${invoice.id}`, body: { payAmount: remaining, method: 'Cash' } }));
  assert.equal(full.status, 200);
  assert.equal(full.body.data.status, 'Paid');
  assert.equal(full.body.data.paid, full.body.data.amount);
  assert.notEqual(full.body.data.receiptNo, firstReceiptNo); // a fresh sequence number per real payment
  assert.equal(full.body.data.receiptSent, true); // the demo backend actually recorded a notification-outbox entry

  // paying an already-settled (or any) invoice past its amount is rejected outright, never silently clamped
  const overpay = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${invoice.id}`, body: { payAmount: 999999, method: 'Cash' } }));
  assert.equal(overpay.status, 409);
  const afterOverpay = store.handle(admin, scope, req({ path: `/invoices/${invoice.id}` })).body.data;
  assert.equal(afterOverpay.paid, full.body.data.paid); // rejected atomically: state is untouched

  // a zero-amount request is a genuine no-op: it never fabricates a partial payment, a timestamp or a receipt
  const otherInvoice = invoices.find((i) => i.id !== invoice.id && i.amount - i.paid > 0);
  const before = { ...otherInvoice };
  const zero = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${otherInvoice.id}`, body: { payAmount: 0, method: 'Card' } }));
  assert.equal(zero.status, 200);
  assert.equal(zero.body.data.paid, before.paid);
  assert.equal(zero.body.data.status, before.status);
  assert.equal(zero.body.data.lastPaymentOn, before.lastPaymentOn);
  assert.equal(zero.body.data.receiptNo, undefined);

  // a direct write to any payment-derived field, without a valid payAmount, is ignored — never a bypass
  const forged = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${otherInvoice.id}`, body: { paid: 999999, status: 'Paid', receiptNo: 'FORGED-1', receiptSent: true, amount: 1 } }));
  assert.equal(forged.status, 200);
  assert.equal(forged.body.data.paid, before.paid);
  assert.equal(forged.body.data.status, before.status);
  assert.equal(forged.body.data.amount, before.amount);
  assert.equal(forged.body.data.receiptNo, undefined);
  assert.equal(forged.body.data.receiptSent, undefined);

  // a NaN payAmount (e.g. a malformed numeric field) is rejected the same as a negative one
  const nanAmount = store.handle(admin, scope, req({ method: 'PATCH', path: `/invoices/${otherInvoice.id}`, body: { payAmount: NaN } }));
  assert.equal(nanAmount.status, 400);
});

test('attachments: create validates base64, permitted type, the 1MB bound, filename traversal, and purpose/role scoping', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher');
  const student = hostUser('student');
  const librarian = hostUser('librarian');
  const base64Of = (bytes) => Buffer.alloc(bytes, 65).toString('base64');
  const upload = (user, over) => store.handle(user, scope, req({ method: 'POST', path: '/attachments', body: { name: 'worksheet.pdf', type: 'application/pdf', content: base64Of(10), purpose: 'assignment', ...over } }));

  const ok = upload(teacher);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.size, 10);
  assert.equal(ok.body.data.downloadPath, `/attachments/${ok.body.data.id}`);
  assert.equal(ok.body.data.content, undefined);

  assert.equal(upload(teacher, { content: 'not base64 at all!!' }).status, 400);
  assert.equal(upload(teacher, { content: '' }).status, 400);
  assert.equal(upload(teacher, { type: 'application/x-msdownload' }).status, 400);
  assert.equal(upload(teacher, { content: base64Of(1024 * 1024 + 1) }).status, 413);
  assert.equal(upload(teacher, { name: '../../etc/passwd' }).status, 400);
  assert.equal(upload(teacher, { name: 'a/b.pdf' }).status, 400);
  assert.equal(upload(teacher, { purpose: 'bogus' }).status, 400);

  assert.equal(upload(student).status, 403); // a student may not create an assignment-purpose attachment
  assert.equal(upload(teacher, { purpose: 'submission' }).status, 403); // nor may a teacher create a submission one
  assert.equal(upload(librarian, { purpose: 'message' }).status, 201); // every role may attach to its own message threads
  assert.equal(upload(librarian).status, 403); // but not outside their domain

  const byOwner = store.handle(teacher, scope, req({ path: `/attachments/${ok.body.data.id}` }));
  assert.equal(byOwner.status, 200);
  assert.equal(byOwner.body.data.content, base64Of(10));
  assert.equal(store.handle(student, scope, req({ path: `/attachments/${ok.body.data.id}` })).status, 403); // unattached: owner only

  assert.equal(store.handle(teacher, scope, req({ path: '/attachments/att-does-not-exist' })).status, 404);
  assert.equal(store.handle(teacher, scope, req({ method: 'DELETE', path: `/attachments/${ok.body.data.id}` })).status, 405);
  assert.equal(store.handle(teacher, scope, req({ method: 'PATCH', path: '/attachments' })).status, 405);
});

test('attachments: assignment-linked downloads follow class membership; an invalid id in the batch rejects atomically', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher'); // t-001, home class 10-A; owns assignments as-41/as-42
  const student = hostUser('student'); // s-1192, class c-10A
  const parent = hostUser('parent'); // children include s-1192
  const admin = hostUser('admin');
  const uploadAssignment = (name) => store.handle(teacher, scope, req({ method: 'POST', path: '/attachments', body: { name, type: 'application/pdf', content: Buffer.from(name).toString('base64'), purpose: 'assignment' } })).body.data.id;

  const attId = uploadAssignment('rubric.pdf');
  assert.equal(store.handle(student, scope, req({ path: `/attachments/${attId}` })).status, 403); // not yet linked

  const link = store.handle(teacher, scope, req({ method: 'PATCH', path: '/assignments/as-41', body: { attachments: [attId] } }));
  assert.equal(link.status, 200);
  // stored/returned shape is always the canonical SchoolAttachment[] contract, even when linked by a legacy bare id
  assert.deepEqual(link.body.data.attachments, [{ id: attId, name: 'rubric.pdf', type: 'application/pdf', size: Buffer.byteLength('rubric.pdf'), downloadPath: `/attachments/${attId}` }]);

  assert.equal(store.handle(student, scope, req({ path: `/attachments/${attId}` })).status, 200); // own class
  assert.equal(store.handle(parent, scope, req({ path: `/attachments/${attId}` })).status, 200); // child's class
  assert.equal(store.handle(admin, scope, req({ path: `/attachments/${attId}` })).status, 200);

  // a teacher outside that class is denied by the existing assignment-write guard, before attachment logic runs
  const otherClassAttId = uploadAssignment('other.pdf');
  const deniedLink = store.handle(teacher, scope, req({ method: 'PATCH', path: '/assignments/as-11', body: { attachments: [otherClassAttId] } }));
  assert.equal(deniedLink.status, 403);

  // one bad id in the batch fails the whole patch, and leaves the otherwise-valid id unlinked
  const validAttId = uploadAssignment('valid.pdf');
  const mixed = store.handle(teacher, scope, req({ method: 'PATCH', path: '/assignments/as-42', body: { attachments: [validAttId, 'att-bogus'] } }));
  assert.equal(mixed.status, 400);
  assert.equal(store.handle(student, scope, req({ path: `/attachments/${validAttId}` })).status, 403);

  // a purpose mismatch (a submission-purpose file) cannot be linked as an assignment attachment
  const submissionAttId = store.handle(student, scope, req({ method: 'POST', path: '/attachments', body: { name: 'answer.pdf', type: 'application/pdf', content: Buffer.from('a').toString('base64'), purpose: 'submission' } })).body.data.id;
  const wrongPurpose = store.handle(teacher, scope, req({ method: 'PATCH', path: '/assignments/as-42', body: { attachments: [submissionAttId] } }));
  assert.equal(wrongPurpose.status, 400);

  // cross-owner reuse is denied even for a valid same-purpose id the caller does not own
  const anotherTeacherOwnedId = store.handle(hostUser('admin'), scope, req({ method: 'POST', path: '/attachments', body: { name: 'admin.pdf', type: 'application/pdf', content: Buffer.from('a').toString('base64'), purpose: 'assignment' } })).body.data.id;
  const crossOwner = store.handle(teacher, scope, req({ method: 'PATCH', path: '/assignments/as-42', body: { attachments: [anotherTeacherOwnedId] } }));
  assert.equal(crossOwner.status, 400);
});

test('attachments: submission-linked downloads follow student-own / teacher-assigned / parent-child; impersonation and purpose mismatch are denied', () => {
  const store = createReferenceSchoolStore();
  const student = hostUser('student'); // s-1192, class c-10A
  const teacher = hostUser('teacher'); // t-001, assigned to c-10A (as-41)
  const parent = hostUser('parent'); // children include s-1192
  const librarian = hostUser('librarian');

  const upload = store.handle(student, scope, req({ method: 'POST', path: '/attachments', body: { name: 'answer.pdf', type: 'application/pdf', content: Buffer.from('answer').toString('base64'), purpose: 'submission' } }));
  const attId = upload.body.data.id;
  assert.equal(store.handle(teacher, scope, req({ path: `/attachments/${attId}` })).status, 403); // unattached: owner only

  const impersonated = store.handle(student, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1193', attachments: [attId] } }));
  assert.equal(impersonated.status, 403); // cannot link a submission attachment under another student's id

  const linked = store.handle(student, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1192', text: 'See attached', attachments: [attId] } }));
  assert.equal(linked.status, 200);
  // stored/returned shape is always the canonical SchoolAttachment[] contract, even when linked by a legacy bare id
  assert.deepEqual(linked.body.data.attachments, [{ id: attId, name: 'answer.pdf', type: 'application/pdf', size: Buffer.byteLength('answer'), downloadPath: `/attachments/${attId}` }]);

  assert.equal(store.handle(student, scope, req({ path: `/attachments/${attId}` })).status, 200); // own submission
  assert.equal(store.handle(teacher, scope, req({ path: `/attachments/${attId}` })).status, 200); // assigned to that class
  assert.equal(store.handle(parent, scope, req({ path: `/attachments/${attId}` })).status, 200); // child's submission
  assert.equal(store.handle(librarian, scope, req({ path: `/attachments/${attId}` })).status, 403); // outside their domain and not the owner

  const assignmentAttId = store.handle(teacher, scope, req({ method: 'POST', path: '/attachments', body: { name: 'r.pdf', type: 'application/pdf', content: Buffer.from('r').toString('base64'), purpose: 'assignment' } })).body.data.id;
  const wrongPurpose = store.handle(student, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1192', attachments: [assignmentAttId] } }));
  assert.equal(wrongPurpose.status, 400);
});

test('attachments: message-linked downloads follow thread ownership; body.owner never overrides it; ids never cross scope', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher');
  const student = hostUser('student');
  const admin = hostUser('admin');

  const attId = store.handle(teacher, scope, req({ method: 'POST', path: '/attachments', body: { name: 'note.pdf', type: 'application/pdf', content: Buffer.from('note').toString('base64'), purpose: 'message' } })).body.data.id;
  const thread = store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data;
  const link = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [...thread.messages, { id: 'm-new', from: 'me', text: 'See the attached note', at: Date.now(), attachments: [attId] }] } }));
  assert.equal(link.status, 200);

  assert.equal(store.handle(teacher, scope, req({ path: `/attachments/${attId}` })).status, 200);
  assert.equal(store.handle(student, scope, req({ path: `/attachments/${attId}` })).status, 403); // a different role's own-thread view, not this thread's owner
  assert.equal(store.handle(admin, scope, req({ path: `/attachments/${attId}` })).status, 200);

  // body.owner can never re-point a thread at another role
  const ownerHijack = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { owner: 'admin' } }));
  assert.equal(ownerHijack.status, 200);
  assert.equal(store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data.owner, 'teacher');

  // a bad attachment id on any one message rejects the whole thread patch atomically
  const secondAttId = store.handle(teacher, scope, req({ method: 'POST', path: '/attachments', body: { name: 'note2.pdf', type: 'application/pdf', content: Buffer.from('note2').toString('base64'), purpose: 'message' } })).body.data.id;
  const mixed = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [{ id: 'm-a', from: 'me', text: 'a', at: Date.now(), attachments: [secondAttId] }, { id: 'm-b', from: 'me', text: 'b', at: Date.now(), attachments: ['att-bogus'] }] } }));
  assert.equal(mixed.status, 400);
  assert.equal(store.handle(student, scope, req({ path: `/attachments/${secondAttId}` })).status, 403); // still unattached
  assert.equal(store.handle(teacher, scope, req({ path: `/attachments/${secondAttId}` })).status, 200); // owner can always read their own upload

  // attachment ids never resolve across a branch/tenant scope boundary
  const otherScope = { applicationId: 'app-1', branchId: 'br-2' };
  const crossScope = store.handle({ ...admin, branch: 'br-2' }, otherScope, req({ path: `/attachments/${attId}` }));
  assert.equal(crossScope.status, 404);
});

test('attachments: real frontend roundtrip — assignments.tsx/messages.tsx link the canonical SchoolAttachment object POST /attachments returned; a legacy bare id still resolves; injected/tampered metadata on that object is never trusted', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher'); // t-001, home class c-10A, owns as-41
  const student = hostUser('student'); // s-1192, class c-10A

  // POST /attachments returns exactly the SchoolAttachment object src/lib/attachments.tsx stores as `attachment`
  const uploaded = store.handle(teacher, scope, req({ method: 'POST', path: '/attachments', body: { name: 'rubric.pdf', type: 'application/pdf', content: Buffer.from('rubric').toString('base64'), purpose: 'assignment' } })).body.data;
  assert.deepEqual(Object.keys(uploaded).sort(), ['downloadPath', 'id', 'name', 'size', 'type']);

  // pages/assignments.tsx sends `attachments: files.attachments` — the SchoolAttachment objects themselves, not ids
  const created = store.handle(teacher, scope, req({ method: 'POST', path: '/assignments', body: { title: 'Roundtrip check', subjectId: 'sub-math', classId: 'c-10A', description: 'x', type: 'Homework', dueDate: '2026-10-05', maxMarks: 10, attachments: [uploaded] } }));
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.data.attachments, [uploaded]);

  // an attacker (or a buggy client) resends that same real id wrapped in forged metadata: none of it is trusted —
  // the stored/returned record is always re-derived from the server's own attachment record for that id
  const forged = { id: uploaded.id, name: 'evil.exe', type: 'application/x-msdownload', size: 999999999, downloadPath: '/etc/passwd', content: 'ignored-too' };
  const tamperPatch = store.handle(teacher, scope, req({ method: 'PATCH', path: `/assignments/${created.body.data.id}`, body: { attachments: [forged] } }));
  assert.equal(tamperPatch.status, 200);
  assert.deepEqual(tamperPatch.body.data.attachments, [uploaded]); // exactly the genuine record, forged fields discarded

  // a legacy caller sending the bare id string still resolves, to the same canonical shape
  const legacyPatch = store.handle(teacher, scope, req({ method: 'PATCH', path: `/assignments/${created.body.data.id}`, body: { attachments: [uploaded.id] } }));
  assert.equal(legacyPatch.status, 200);
  assert.deepEqual(legacyPatch.body.data.attachments, [uploaded]);

  // pages/assignments.tsx PATCH /submissions the same way: `attachments: files.attachments`
  const subUpload = store.handle(student, scope, req({ method: 'POST', path: '/attachments', body: { name: 'answer.pdf', type: 'application/pdf', content: Buffer.from('answer').toString('base64'), purpose: 'submission' } })).body.data;
  const subLinked = store.handle(student, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1192', text: 'See attached', attachments: [subUpload] } }));
  assert.equal(subLinked.status, 200);
  assert.deepEqual(subLinked.body.data.attachments, [subUpload]);
  // a forged submission attachment object (real id, fake size/name) never overrides the true stored record
  const subTampered = store.handle(student, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1192', attachments: [{ ...subUpload, name: 'hacked.pdf', size: 1 }] } }));
  assert.equal(subTampered.status, 200);
  assert.deepEqual(subTampered.body.data.attachments, [subUpload]);

  // pages/messages.tsx sends `attachments: files.attachments` on a new message the same way
  const msgUpload = store.handle(teacher, scope, req({ method: 'POST', path: '/attachments', body: { name: 'note.pdf', type: 'application/pdf', content: Buffer.from('note').toString('base64'), purpose: 'message' } })).body.data;
  const thread = store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data;
  const msgLinked = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [...thread.messages, { id: 'm-frontend', from: 'me', text: 'See attached', at: Date.now(), attachments: [msgUpload] }] } }));
  assert.equal(msgLinked.status, 200);
  const savedMsg = msgLinked.body.data.messages.find((m) => m.id === 'm-frontend');
  assert.deepEqual(savedMsg.attachments, [msgUpload]);

  // download roundtrip: the exact original bytes come back for a permitted viewer
  const download = store.handle(teacher, scope, req({ path: `/attachments/${uploaded.id}` }));
  assert.equal(download.status, 200);
  assert.equal(download.body.data.content, Buffer.from('rubric').toString('base64'));
});

test('quiz shuffle: deterministic per-identity question/option delivery order, accurate server grading against that order, and revealAnswers:false withholds the answer key even after grading', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const teacher = hostUser('teacher'); // t-001, home class c-10A
  const student = hostUser('student'); // s-1192, class c-10A

  const authoredQuestions = [
    { id: 'sq1', text: 'Question one', options: ['a-wrong', 'b-wrong', 'c-right', 'd-wrong'], answer: 2, points: 1, explanation: 'because c' },
    { id: 'sq2', text: 'Question two', options: ['e-right', 'f-wrong', 'g-wrong', 'h-wrong'], answer: 0, points: 1, explanation: 'because e' },
    { id: 'sq3', text: 'Question three', options: ['i-wrong', 'j-wrong', 'k-wrong', 'l-right'], answer: 3, points: 1, explanation: 'because l' },
    { id: 'sq4', text: 'Question four', options: ['m-wrong', 'n-right', 'o-wrong', 'p-wrong'], answer: 1, points: 1, explanation: 'because n' },
  ];
  const correctTextByQuestion = Object.fromEntries(authoredQuestions.map((q) => [q.text, q.options[q.answer]]));

  const createQuiz = (extra) => store.handle(teacher, scope, req({ method: 'POST', path: '/quizzes', body: { title: 'Shuffle check', subjectId: 'sub-math', classId: 'c-10A', durationMin: 10, dueDate: '2026-10-05', status: 'Published', shuffle: true, questions: authoredQuestions, ...extra } })).body.data;

  const quiz = createQuiz({});
  const answerAsDelivered = (delivered) => delivered.map((q) => q.options.indexOf(correctTextByQuestion[q.text]));

  // repeated GET by the same identity always returns the same delivery order
  const firstAsStudent = store.handle(student, scope, req({ path: `/quizzes/${quiz.id}/questions` })).body.data;
  const secondAsStudent = store.handle(student, scope, req({ path: `/quizzes/${quiz.id}/questions` })).body.data;
  assert.deepEqual(firstAsStudent, secondAsStudent);
  assert.ok(firstAsStudent.every((q) => q.answer === undefined)); // the student never sees the answer key

  // a different identity (the teacher) gets its own, independently-derived order (staff preview honors shuffle too)
  const asTeacher = store.handle(teacher, scope, req({ path: `/quizzes/${quiz.id}/questions` })).body.data;
  assert.ok(typeof asTeacher[0].answer === 'number'); // staff sees the key
  assert.notDeepEqual(asTeacher.map((q) => ({ text: q.text, options: q.options })), firstAsStudent.map((q) => ({ text: q.text, options: q.options })));

  // grading uses that exact same per-identity order: answers translated from the delivered option text score 100%
  const studentAnswers = answerAsDelivered(firstAsStudent);
  const graded = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${quiz.id}/grade`, body: { studentId: 's-1192', answers: studentAnswers, timeTaken: 30 } }));
  assert.equal(graded.status, 201);
  assert.equal(graded.body.data.score, graded.body.data.total);
  assert.equal(graded.body.data.total, authoredQuestions.length);
  // the review comes back in the same delivered order, with the option index correctly translated
  graded.body.data.review.forEach((r, k) => assert.equal(firstAsStudent[k].options[r.answer], correctTextByQuestion[firstAsStudent[k].text]));

  // an author preview grade also uses the shuffle, and always sees the full key regardless of revealAnswers
  const teacherAnswers = answerAsDelivered(asTeacher);
  const preview = store.handle(teacher, scope, req({ method: 'POST', path: `/quizzes/${quiz.id}/grade`, body: { answers: teacherAnswers, timeTaken: 5, preview: true } }));
  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.score, preview.body.data.total);
  assert.ok(preview.body.data.review.every((r) => typeof r.answer === 'number'));

  // revealAnswers: false withholds the key from the student's own graded result and every later saved-attempt view
  const hiddenQuiz = createQuiz({ revealAnswers: false });
  const hiddenDelivered = store.handle(student, scope, req({ path: `/quizzes/${hiddenQuiz.id}/questions` })).body.data;
  const hiddenAnswers = answerAsDelivered(hiddenDelivered);
  const hiddenGraded = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${hiddenQuiz.id}/grade`, body: { studentId: 's-1192', answers: hiddenAnswers, timeTaken: 20 } }));
  assert.equal(hiddenGraded.status, 201);
  assert.equal(hiddenGraded.body.data.score, hiddenGraded.body.data.total); // the grade itself is never faked...
  assert.deepEqual(hiddenGraded.body.data.review, []); // ...but the answer key is withheld

  const savedForStudent = store.handle(student, scope, req({ path: '/quiz-attempts', query: { quizId: hiddenQuiz.id } }));
  assert.deepEqual(savedForStudent.body.data.review, []);
  const savedForAdmin = store.handle(admin, scope, req({ path: '/quiz-attempts', query: { studentId: 's-1192', quizId: hiddenQuiz.id } }));
  assert.deepEqual(savedForAdmin.body.data.review, []);
  // ...but a teacher/admin author preview on that same hidden-reveal quiz still sees the full key
  const hiddenPreview = store.handle(teacher, scope, req({ method: 'POST', path: `/quizzes/${hiddenQuiz.id}/grade`, body: { answers: answerAsDelivered(store.handle(teacher, scope, req({ path: `/quizzes/${hiddenQuiz.id}/questions` })).body.data), timeTaken: 5, preview: true } }));
  assert.ok(hiddenPreview.body.data.review.every((r) => typeof r.answer === 'number'));
});

test('server-initialized POST metrics: books/classes/quizzes/assignments compute aggregates server-side; client-supplied aggregates are ignored; invalid counts and unknown class/teacher references reject atomically', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const teacher = hostUser('teacher'); // t-001, home class c-10A

  // books: available/rating/cover always computed server-side from copies/title — never trusted from the client
  const totalBooksBefore = store.handle(admin, scope, req({ path: '/books', query: { pageSize: '1' } })).body.total;
  const book = store.handle(admin, scope, req({ method: 'POST', path: '/books', body: { title: 'New Arrivals', author: 'A. Author', category: 'Fiction', publisher: 'P', year: 2026, copies: 5, available: 999, rating: 4.9, cover: 'hacked.png' } }));
  assert.equal(book.status, 201);
  assert.equal(book.body.data.copies, 5);
  assert.equal(book.body.data.available, 5); // never NaN, never the injected value
  assert.equal(book.body.data.rating, 0);
  assert.notEqual(book.body.data.cover, 'hacked.png');
  assert.equal(store.handle(admin, scope, req({ method: 'POST', path: '/books', body: { title: 'Bad', copies: -1 } })).status, 400);
  assert.equal(store.handle(admin, scope, req({ method: 'POST', path: '/books', body: { title: 'Bad2', copies: 1.5 } })).status, 400);
  assert.equal(store.handle(admin, scope, req({ method: 'POST', path: '/books', body: { title: 'Bad3', copies: 'lots' } })).status, 400);
  const totalBooksAfter = store.handle(admin, scope, req({ path: '/books', query: { pageSize: '1' } })).body.total;
  assert.equal(totalBooksAfter, totalBooksBefore + 1); // the three invalid creates never landed (atomic)

  // the book-copies invariant holds on a supported PATCH: `available` is always recomputed from real issued-out counts
  const outstandingIssue = store.handle(admin, scope, req({ method: 'POST', path: '/issues', body: { bookId: book.body.data.id, memberId: 's-1192', memberName: 'Elena Vasquez', memberType: 'Student', issuedOn: '2026-01-01', dueOn: '2026-01-15' } }));
  assert.equal(outstandingIssue.status, 201);
  assert.equal(store.handle(admin, scope, req({ method: 'PATCH', path: `/books/${book.body.data.id}`, body: { copies: 0 } })).status, 409); // below the one copy actually issued out
  const copiesPatch = store.handle(admin, scope, req({ method: 'PATCH', path: `/books/${book.body.data.id}`, body: { copies: 4, rating: 4.5, shelf: 'C-9' } }));
  assert.equal(copiesPatch.status, 200);
  assert.equal(copiesPatch.body.data.copies, 4);
  assert.equal(copiesPatch.body.data.available, 3); // 4 copies − 1 issued out
  assert.equal(copiesPatch.body.data.rating, 0); // still server-owned: never settable via any PATCH
  assert.equal(copiesPatch.body.data.shelf, 'C-9'); // an ordinary, non-aggregate field still merges normally

  // reproduces the reported defect exactly: a bare `{available: 999}` PATCH must never move real stock
  const forgedAvailable = store.handle(admin, scope, req({ method: 'PATCH', path: `/books/${book.body.data.id}`, body: { available: 999 } }));
  assert.equal(forgedAvailable.status, 200);
  assert.equal(forgedAvailable.body.data.available, 3); // unchanged: still copies(4) − issuedOut(1)
  assert.equal(forgedAvailable.body.data.copies, 4);
  const forgedCover = store.handle(admin, scope, req({ method: 'PATCH', path: `/books/${book.body.data.id}`, body: { cover: 'hacked.png' } }));
  assert.notEqual(forgedCover.body.data.cover, 'hacked.png'); // cover only ever changes via a real `title` update

  // classes: strength/avgScore always start at zero
  const cls = store.handle(admin, scope, req({ method: 'POST', path: '/classes', body: { grade: 6, section: 'Z', name: 'Grade 6-Z', classTeacherId: 't-001', room: 'X-1', capacity: 30, strength: 999, avgScore: 88 } }));
  assert.equal(cls.status, 201);
  assert.equal(cls.body.data.strength, 0);
  assert.equal(cls.body.data.avgScore, 0);
  assert.equal(store.handle(admin, scope, req({ method: 'POST', path: '/classes', body: { grade: 6, section: 'Y', name: 'Grade 6-Y', classTeacherId: 't-does-not-exist' } })).status, 422);
  // strength/avgScore also cannot be forged via a direct PATCH, and an unknown classTeacherId is still rejected there
  const clsPatch = store.handle(admin, scope, req({ method: 'PATCH', path: `/classes/${cls.body.data.id}`, body: { strength: 999, avgScore: 100, room: 'X-2' } }));
  assert.equal(clsPatch.status, 200);
  assert.equal(clsPatch.body.data.strength, 0);
  assert.equal(clsPatch.body.data.avgScore, 0);
  assert.equal(clsPatch.body.data.room, 'X-2');
  assert.equal(store.handle(admin, scope, req({ method: 'PATCH', path: `/classes/${cls.body.data.id}`, body: { classTeacherId: 't-does-not-exist' } })).status, 422);

  // quizzes: attempts/avgScore always start at zero
  const quiz = store.handle(teacher, scope, req({ method: 'POST', path: '/quizzes', body: { title: 'Pop quiz', subjectId: 'sub-math', classId: 'c-10A', durationMin: 10, dueDate: '2026-10-05', status: 'Published', questions: [{ id: 'qq1', text: 'Q', options: ['a', 'b'], answer: 0, points: 1 }], attempts: 500, avgScore: 100 } }));
  assert.equal(quiz.status, 201);
  assert.equal(quiz.body.data.attempts, 0);
  assert.equal(quiz.body.data.avgScore, 0);
  assert.equal(store.handle(admin, scope, req({ method: 'POST', path: '/quizzes', body: { title: 'x', subjectId: 'sub-math', classId: 'c-does-not-exist', durationMin: 5, questions: [] } })).status, 422);
  // matches the actual source flow (pages/quizzes.tsx PATCHes only `status`); attempts/avgScore still cannot be forged
  const quizPatch = store.handle(teacher, scope, req({ method: 'PATCH', path: `/quizzes/${quiz.body.data.id}`, body: { status: 'Closed', attempts: 500, avgScore: 91 } }));
  assert.equal(quizPatch.status, 200);
  assert.equal(quizPatch.body.data.status, 'Closed');
  assert.equal(quizPatch.body.data.attempts, 0);
  assert.equal(quizPatch.body.data.avgScore, 0);
  assert.equal(store.handle(teacher, scope, req({ method: 'PATCH', path: `/quizzes/${quiz.body.data.id}`, body: { classId: 'c-does-not-exist' } })).status, 422);

  // assignments: submitted/graded start at zero, total reflects the actual class roster (not a client-supplied value)
  const roster = store.handle(admin, scope, req({ path: '/students', query: { classId: 'c-10A', pageSize: '1' } })).body.total;
  const assignment = store.handle(teacher, scope, req({ method: 'POST', path: '/assignments', body: { title: 'Extra practice', subjectId: 'sub-math', classId: 'c-10A', description: 'x', type: 'Homework', dueDate: '2026-10-05', maxMarks: 10, submitted: 999, graded: 999, total: 1 } }));
  assert.equal(assignment.status, 201);
  assert.equal(assignment.body.data.submitted, 0);
  assert.equal(assignment.body.data.graded, 0);
  assert.equal(assignment.body.data.total, roster);
  assert.equal(store.handle(admin, scope, req({ method: 'POST', path: '/assignments', body: { title: 'x', subjectId: 'sub-math', classId: 'nope', description: 'x', type: 'Homework', dueDate: '2026-10-05', maxMarks: 10 } })).status, 422);
  const assignmentPatch = store.handle(teacher, scope, req({ method: 'PATCH', path: `/assignments/${assignment.body.data.id}`, body: { submitted: 999, graded: 999, total: 1, status: 'Closed' } }));
  assert.equal(assignmentPatch.status, 200);
  assert.equal(assignmentPatch.body.data.submitted, 0);
  assert.equal(assignmentPatch.body.data.graded, 0);
  assert.equal(assignmentPatch.body.data.total, roster);
  assert.equal(assignmentPatch.body.data.status, 'Closed');

  // students: feeStatus is derived from real invoices, never client-settable directly
  const studentBefore = store.handle(admin, scope, req({ path: '/students/s-1192' })).body.data;
  const feeStatusForge = store.handle(admin, scope, req({ method: 'PATCH', path: '/students/s-1192', body: { feeStatus: 'Paid', gpa: 4.0, attendancePct: 100, house: 'Everest', phone: '+1 555 9999' } }));
  assert.equal(feeStatusForge.status, 200);
  // derived fields (from real invoices/marks/attendance) are never client-settable...
  assert.equal(feeStatusForge.body.data.feeStatus, studentBefore.feeStatus);
  assert.equal(feeStatusForge.body.data.gpa, studentBefore.gpa);
  assert.equal(feeStatusForge.body.data.attendancePct, studentBefore.attendancePct);
  // ...while authored registration fields on the very same request still merge normally
  assert.equal(feeStatusForge.body.data.house, 'Everest');
  assert.equal(feeStatusForge.body.data.phone, '+1 555 9999');

  // deleting a student symmetrically corrects the roster its own creation incremented
  const rosterBefore = store.handle(admin, scope, req({ path: '/classes/c-6A' })).body.data.strength;
  const newStudent = store.handle(admin, scope, req({ method: 'POST', path: '/students', body: { name: 'Temp Student', classId: 'c-6A', gender: 'Female' } }));
  assert.equal(store.handle(admin, scope, req({ path: '/classes/c-6A' })).body.data.strength, rosterBefore + 1);
  store.handle(admin, scope, req({ method: 'DELETE', path: `/students/${newStudent.body.data.id}` }));
  assert.equal(store.handle(admin, scope, req({ path: '/classes/c-6A' })).body.data.strength, rosterBefore);
});

test('library return: authoritative $0.50/day-late fine computed from the real due/return dates, on-time return is free, and a repeated return is idempotent (no double fine, no double stock increment)', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const book = store.handle(admin, scope, req({ path: '/books', query: { pageSize: '1' } })).body.data[0];
  const availableBefore = book.available;

  const onTime = store.handle(admin, scope, req({ method: 'POST', path: '/issues', body: { bookId: book.id, memberId: 's-1192', memberName: 'Elena Vasquez', memberType: 'Student', issuedOn: '2026-01-01', dueOn: '2099-01-01' } })).body.data;
  const onTimeReturn = store.handle(admin, scope, req({ method: 'PATCH', path: `/issues/${onTime.id}`, body: { action: 'return' } }));
  assert.equal(onTimeReturn.status, 200);
  assert.equal(onTimeReturn.body.data.fine, 0); // due date is in the future: never late

  const overdue = store.handle(admin, scope, req({ method: 'POST', path: '/issues', body: { bookId: book.id, memberId: 's-1072', memberName: 'Mateo Vasquez', memberType: 'Student', issuedOn: '2020-01-01', dueOn: '2020-01-15' } })).body.data;
  const firstReturn = store.handle(admin, scope, req({ method: 'PATCH', path: `/issues/${overdue.id}`, body: { action: 'return' } }));
  assert.equal(firstReturn.status, 200);
  assert.equal(firstReturn.status, 200);
  const daysLate = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(2020, 0, 15).setHours(0, 0, 0, 0)) / 86400000);
  assert.equal(firstReturn.body.data.fine, Math.round(daysLate * 0.5 * 100) / 100); // source policy: $0.50/day late
  assert.equal(firstReturn.body.data.returnedOn, isoDay(new Date()));
  assert.equal(store.handle(admin, scope, req({ path: '/books', query: { pageSize: '1' } })).body.data[0].available, availableBefore + 0); // net: two issued, two returned

  // repeating the same return is a no-op: the fine and stock are never doubled
  const secondReturn = store.handle(admin, scope, req({ method: 'PATCH', path: `/issues/${overdue.id}`, body: { action: 'return' } }));
  assert.equal(secondReturn.status, 200);
  assert.equal(secondReturn.body.data.fine, firstReturn.body.data.fine);
  assert.equal(secondReturn.body.data.returnedOn, firstReturn.body.data.returnedOn);
  assert.equal(store.handle(admin, scope, req({ path: '/books', query: { pageSize: '1' } })).body.data[0].available, availableBefore);
});
function isoDay(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

test('submissions: a student can never set their own grade/feedback, and a teacher grading can never overwrite the student-authored submission text', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher'); // t-001, owns as-41 (class c-10A)
  const student = hostUser('student'); // s-1192, class c-10A

  const studentGradesSelf = store.handle(student, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1192', marks: 100, feedback: 'Great job me!' } }));
  assert.equal(studentGradesSelf.status, 403);
  const unchangedForStudent = store.handle(student, scope, req({ path: '/submissions', query: { assignmentId: 'as-41' } })).body.data.find((s) => s.studentId === 's-1192');
  assert.notEqual(unchangedForStudent.marks, 100);
  assert.notEqual(unchangedForStudent.feedback, 'Great job me!');

  const teacherOverwritesText = store.handle(teacher, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1192', marks: 8, text: 'rewritten by the teacher' } }));
  assert.equal(teacherOverwritesText.status, 403); // the whole request is rejected — grading and authoring text are never combined
  const stillUngraded = store.handle(teacher, scope, req({ path: '/submissions', query: { assignmentId: 'as-41' } })).body.data.find((s) => s.studentId === 's-1192');
  assert.notEqual(stillUngraded.marks, 8);
  assert.notEqual(stillUngraded.text, 'rewritten by the teacher');

  const legitimateGrade = store.handle(teacher, scope, req({ method: 'PATCH', path: '/submissions', body: { assignmentId: 'as-41', studentId: 's-1192', marks: 8, feedback: 'Good work' } }));
  assert.equal(legitimateGrade.status, 200);
  assert.equal(legitimateGrade.body.data.marks, 8);
  assert.equal(legitimateGrade.body.data.status, 'Graded');
});

test('thread messages: a caller can never fabricate a new message "from" the other party, and can never rewrite an already-stored message', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher');
  const thread = store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data;

  const impersonation = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [...thread.messages, { id: 'm-fake', from: 'them', text: 'I (the parent) admit fault', at: Date.now() }] } }));
  assert.equal(impersonation.status, 403);
  assert.equal(store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data.messages.length, thread.messages.length); // nothing was appended

  const invalidFrom = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [...thread.messages, { id: 'm-bad-role', from: 'admin', text: 'x', at: Date.now() }] } }));
  assert.equal(invalidFrom.status, 400);

  const rewrite = thread.messages[0];
  const tampered = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [{ ...rewrite, text: 'rewritten history' }, ...thread.messages.slice(1)] } }));
  assert.equal(tampered.status, 400);
  assert.equal(store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data.messages[0].text, rewrite.text); // history is untouched

  // the real flow (a genuinely new message authored by the caller) still works
  const legit = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [...thread.messages, { id: 'm-legit', from: 'me', text: 'a real reply', at: Date.now() }] } }));
  assert.equal(legit.status, 200);
  assert.ok(legit.body.data.messages.some((m) => m.id === 'm-legit'));
});

test('thread messages: a patch may never silently drop a previously persisted message id (or its attachment links); the real full-array append is unaffected and the rejection is atomic', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher');
  const attId = store.handle(teacher, scope, req({ method: 'POST', path: '/attachments', body: { name: 'note.pdf', type: 'application/pdf', content: Buffer.from('note').toString('base64'), purpose: 'message' } })).body.data.id;
  const thread = store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data;
  const withAttachment = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [...thread.messages, { id: 'm-att', from: 'me', text: 'see attached', at: Date.now(), attachments: [attId] } ] } }));
  assert.equal(withAttachment.status, 200);
  const full = withAttachment.body.data.messages;

  // dropping one previously persisted id (even keeping everything else identical) is rejected...
  const dropped = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: full.filter((m) => m.id !== 'm1') } }));
  assert.equal(dropped.status, 400);
  // ...atomically: the thread's stored messages, content and attachment links are exactly as before the rejected call
  const unchanged = store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data.messages;
  assert.deepEqual(unchanged, full);

  // stripping the attachment link off an already-stored message (id kept, link dropped) is also rejected
  const strippedLink = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: full.map((m) => (m.id === 'm-att' ? { ...m, attachments: [] } : m)) } }));
  assert.equal(strippedLink.status, 400);
  assert.deepEqual(store.handle(teacher, scope, req({ path: '/threads/th-1' })).body.data.messages, full);

  // the real client behavior — the untouched full array plus one new message — still succeeds
  const legitAppend = store.handle(teacher, scope, req({ method: 'PATCH', path: '/threads/th-1', body: { messages: [...full, { id: 'm-more', from: 'me', text: 'one more', at: Date.now() }] } }));
  assert.equal(legitAppend.status, 200);
  assert.equal(legitAppend.body.data.messages.length, full.length + 1);
});

test('quiz authority: student list/detail/questions/grade are scoped to their own class; a new attempt requires a Published quiz; a completed attempt is still readable/retryable after the quiz closes; an unassigned teacher never gets the answer key or preview access; the owning/assigned teacher and admin still can', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const teacher = hostUser('teacher'); // t-001, home class c-10A
  const student = hostUser('student'); // s-1192, class c-10A

  const q = (id) => ({ id, text: `Question ${id}`, options: ['a', 'b', 'c', 'd'], answer: 1, points: 1 });
  // c-7A: an established "t-001 has no ownership/assignment here" class (also used by the existing qz-9 case)
  const otherClassQuiz = store.handle(admin, scope, req({ method: 'POST', path: '/quizzes', body: { title: 'Other class quiz', subjectId: 'sub-math', classId: 'c-7A', durationMin: 10, dueDate: '2026-10-05', status: 'Published', questions: [q('a')] } })).body.data;
  const ownQuiz = store.handle(teacher, scope, req({ method: 'POST', path: '/quizzes', body: { title: 'Own class quiz', subjectId: 'sub-math', classId: 'c-10A', durationMin: 10, dueDate: '2026-10-05', status: 'Published', questions: [q('b')] } })).body.data;
  const closedQuiz = store.handle(teacher, scope, req({ method: 'POST', path: '/quizzes', body: { title: 'Closed quiz', subjectId: 'sub-math', classId: 'c-10A', durationMin: 10, dueDate: '2026-09-01', status: 'Closed', questions: [q('c')] } })).body.data;
  const draftQuiz = store.handle(teacher, scope, req({ method: 'POST', path: '/quizzes', body: { title: 'Draft quiz', subjectId: 'sub-math', classId: 'c-10A', durationMin: 10, dueDate: '2026-10-05', status: 'Draft', questions: [q('d')] } })).body.data;

  // reproduces the reported defect exactly: another class's quiz is never reachable by a student, at any route
  assert.ok(!store.handle(student, scope, req({ path: '/quizzes', query: { classId: 'c-7A' } })).body.data.some((x) => x.id === otherClassQuiz.id));
  assert.equal(store.handle(student, scope, req({ path: `/quizzes/${otherClassQuiz.id}` })).status, 403);
  assert.equal(store.handle(student, scope, req({ path: `/quizzes/${otherClassQuiz.id}/questions` })).status, 403);
  assert.equal(store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${otherClassQuiz.id}/grade`, body: { answers: [1], timeTaken: 5 } })).status, 403);
  assert.equal(store.handle(student, scope, req({ method: 'POST', path: '/quiz-attempts', body: { quizId: otherClassQuiz.id, answers: [1] } })).status, 403);
  // admin is unaffected by any of this class scoping
  assert.equal(store.handle(admin, scope, req({ path: `/quizzes/${otherClassQuiz.id}/questions` })).status, 200);

  // an unassigned teacher (not the author, not teaching that class) never gets the answer key or preview access —
  // reusing the same class/identity relationship the existing qz-9 case already established
  assert.equal(store.handle(teacher, scope, req({ path: `/quizzes/${otherClassQuiz.id}/questions` })).status, 403);
  assert.equal(store.handle(teacher, scope, req({ method: 'POST', path: `/quizzes/${otherClassQuiz.id}/grade`, body: { answers: [1], timeTaken: 5, preview: true } })).status, 403);
  // ...but the actual owner/assigned teacher's author-key and preview access on their own quiz still works
  const ownQuestions = store.handle(teacher, scope, req({ path: `/quizzes/${ownQuiz.id}/questions` }));
  assert.equal(ownQuestions.status, 200);
  assert.ok(ownQuestions.body.data.every((qq) => typeof qq.answer === 'number'));
  const ownPreview = store.handle(teacher, scope, req({ method: 'POST', path: `/quizzes/${ownQuiz.id}/grade`, body: { answers: [1], timeTaken: 5, preview: true } }));
  assert.equal(ownPreview.status, 200);
  assert.equal(ownPreview.body.data.score, ownPreview.body.data.total);

  // own class, but not actually open: a Closed or Draft quiz never lets a student start a brand-new attempt
  assert.equal(store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${closedQuiz.id}/grade`, body: { answers: [1], timeTaken: 5 } })).status, 409);
  assert.equal(store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${draftQuiz.id}/grade`, body: { answers: [1], timeTaken: 5 } })).status, 409);
  assert.equal(store.handle(student, scope, req({ method: 'POST', path: '/quiz-attempts', body: { quizId: draftQuiz.id, answers: [1] } })).status, 409);

  // a legitimate new attempt on the actually-published, own-class quiz succeeds
  const graded = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${ownQuiz.id}/grade`, body: { answers: [1], timeTaken: 5 } }));
  assert.equal(graded.status, 201);
  assert.equal(graded.body.data.score, graded.body.data.total);

  // the teacher then closes it — reading and idempotently retrying that SAME committed attempt still works...
  const closeIt = store.handle(teacher, scope, req({ method: 'PATCH', path: `/quizzes/${ownQuiz.id}`, body: { status: 'Closed' } }));
  assert.equal(closeIt.status, 200);
  const retry = store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${ownQuiz.id}/grade`, body: { answers: [1], timeTaken: 999 } }));
  assert.equal(retry.status, 200); // not 201: no second attempt was created
  assert.equal(retry.body.data.score, graded.body.data.score);
  const readAfterClose = store.handle(student, scope, req({ path: '/quiz-attempts', query: { quizId: ownQuiz.id } }));
  assert.equal(readAfterClose.body.data.score, graded.body.data.score);
  // ...but a genuinely different answer set on the now-closed quiz is still a real conflict, not a silent do-over
  assert.equal(store.handle(student, scope, req({ method: 'POST', path: `/quizzes/${ownQuiz.id}/grade`, body: { answers: [0], timeTaken: 5 } })).status, 409);
});

test('live sessions: offsetMin is anchored to the real current instant (source src/lib/mock/db.ts materializeLive, lines 72-82), not fixture midnight — /live list and /stats agree, and an explicit authored start is always respected', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const testNow = Date.now();

  const list = store.handle(admin, scope, req({ path: '/live' })).body.data;
  // a fixed-title seeded session authored as "started 12 minutes ago, runs 45 minutes": under the fixed-to-midnight
  // bug its `start` would land near actual midnight (many hours from `testNow` outside a brief window); anchored to
  // "now" it must land ~12 minutes before whenever this test happens to run.
  const quadratic = list.find((s) => s.title === 'Quadratic equations – factorisation methods');
  assert.ok(quadratic, 'expected the seeded fixed-title live session to exist');
  const startDeltaMin = (new Date(quadratic.start).getTime() - testNow) / 60000;
  assert.ok(Math.abs(startDeltaMin + 12) < 2, `expected start ~12 minutes before now, got ${startDeltaMin} minutes`);
  assert.equal(quadratic.status, 'Live'); // -12..+33 minute window: live right now, regardless of wall-clock time

  // most seeded sessions are authored within a few hours of "now" — a midnight-anchored bug would scatter nearly
  // all of them many hours away from `testNow` except in a brief window right after actual midnight
  const closeToNow = list.filter((s) => Math.abs(new Date(s.start).getTime() - testNow) < 6 * 3600 * 1000);
  assert.ok(closeToNow.length >= 5, `expected most sessions anchored near now, only ${closeToNow.length} were`);

  // list and /stats must derive the exact same materialization (same Live set, not two different clocks)
  const statsData = store.handle(admin, scope, req({ path: '/stats', query: { role: 'admin' } })).body.data;
  const liveFromList = list.filter((s) => s.status === 'Live').map((s) => s.id).sort();
  assert.deepEqual(statsData.liveNow.map((s) => s.id).sort(), liveFromList);
  assert.ok(liveFromList.length > 0, 'the reported defect: a midnight-anchored clock left liveNow empty at non-midnight test times');

  // an explicit authored start is always respected, independent of the offsetMin anchor fix above
  const pastStart = new Date(testNow - 2 * 3600000).toISOString();
  const futureStart = new Date(testNow + 2 * 3600000).toISOString();
  const past = store.handle(admin, scope, req({ method: 'POST', path: '/live', body: { title: 'Explicit past session', kind: 'Class', classId: 'c-10A', subjectId: 'sub-math', teacherId: 't-001', start: pastStart, durationMin: 30 } })).body.data;
  const future = store.handle(admin, scope, req({ method: 'POST', path: '/live', body: { title: 'Explicit future session', kind: 'Class', classId: 'c-10A', subjectId: 'sub-math', teacherId: 't-001', start: futureStart, durationMin: 30 } })).body.data;
  const afterCreate = store.handle(admin, scope, req({ path: '/live' })).body.data;
  const pastRow = afterCreate.find((s) => s.id === past.id);
  const futureRow = afterCreate.find((s) => s.id === future.id);
  assert.equal(pastRow.start, pastStart);
  assert.equal(pastRow.status, 'Ended'); // 2h ago + 30min duration: long over
  assert.equal(futureRow.start, futureStart);
  assert.equal(futureRow.status, 'Scheduled');
});

test('live "end": an accepted host/admin end persists the session as Ended for later /live list/detail and /stats calls, is idempotent on retry, and a non-host end is denied without any mutation', () => {
  const store = createReferenceSchoolStore();
  const teacher = hostUser('teacher'); // t-001 is the seeded host/teacher of lv-1, currently Live (offsetMin -12)
  const student = hostUser('student'); // s-1192, class c-10A: authorized to reach the room, but never its host
  const admin = hostUser('admin');
  const liveId = 'lv-1';

  const before = store.handle(admin, scope, req({ path: `/live/${liveId}` })).body.data;
  assert.equal(before.status, 'Live'); // must start from a genuinely live session to prove the transition to Ended

  // a non-host end is denied and mutates nothing
  const denied = store.handle(student, scope, req({ method: 'POST', path: `/live/${liveId}/actions`, body: { action: 'end' } }));
  assert.equal(denied.status, 403);
  assert.equal(store.handle(admin, scope, req({ path: `/live/${liveId}` })).body.data.status, before.status);

  // the host ends it: the response keeps the existing LiveRoomState shape the UI already navigates away on...
  const ended = store.handle(teacher, scope, req({ method: 'POST', path: `/live/${liveId}/actions`, body: { action: 'end' } }));
  assert.equal(ended.status, 200);
  assert.deepEqual(Object.keys(ended.body.data).sort(), ['elapsed', 'messages', 'people', 'poll', 'recording', 'scores']);
  // ...but the underlying mock session — not just the in-memory room — is now really Ended, everywhere
  assert.equal(store.handle(admin, scope, req({ path: '/live' })).body.data.find((s) => s.id === liveId).status, 'Ended');
  assert.equal(store.handle(admin, scope, req({ path: `/live/${liveId}` })).body.data.status, 'Ended');
  assert.ok(!store.handle(admin, scope, req({ path: '/stats', query: { role: 'admin' } })).body.data.liveNow.some((s) => s.id === liveId));

  // idempotent: ending an already-ended session again is not an error and does not un-end it
  const endedAgain = store.handle(teacher, scope, req({ method: 'POST', path: `/live/${liveId}/actions`, body: { action: 'end' } }));
  assert.equal(endedAgain.status, 200);
  assert.equal(store.handle(admin, scope, req({ path: `/live/${liveId}` })).body.data.status, 'Ended');
});

test('stats: admin may read the accountant finance projection (source ReportsPage fetches both directly) without ever mutating their own session identity; a teacher still cannot request it; an unrecognized role is still rejected; branch scoping and student/parent ownership are unaffected', () => {
  const store = createReferenceSchoolStore();
  const admin = hostUser('admin');
  const teacher = hostUser('teacher');

  const asAdminOwn = store.handle(admin, scope, req({ path: '/stats', query: { role: 'admin' } }));
  assert.equal(asAdminOwn.status, 200);
  const asAdminAccountant = store.handle(admin, scope, req({ path: '/stats', query: { role: 'accountant' } }));
  assert.equal(asAdminAccountant.status, 200);
  const directAccountant = store.handle(hostUser('accountant'), scope, req({ path: '/stats', query: { role: 'accountant' } }));
  assert.deepEqual(asAdminAccountant.body.data, directAccountant.body.data); // identical finance calculations either way

  // reading the accountant projection never mutates the admin's own authenticated identity/session role
  const sessionAfter = store.handle(admin, scope, req({ path: '/session', query: { role: 'admin' } }));
  assert.equal(sessionAfter.status, 200);
  assert.equal(sessionAfter.body.data.role, 'admin');
  // /session itself still refuses a role-elevation attempt — unrelated to, and unweakened by, this /stats allowance
  assert.equal(store.handle(admin, scope, req({ path: '/session', query: { role: 'accountant' } })).status, 403);

  // a teacher can never request the accountant projection, even though admin now can
  assert.equal(store.handle(teacher, scope, req({ path: '/stats', query: { role: 'accountant' } })).status, 403);
  // an unrecognized role is still rejected for admin too — no arbitrary role is ever accepted
  assert.equal(store.handle(admin, scope, req({ path: '/stats', query: { role: 'not-a-real-role' } })).status, 403);

  // branch/tenant scoping is unaffected by this allowance
  const otherBranchAdmin = { ...admin, branch: 'br-2' };
  const otherScope = { applicationId: 'app-1', branchId: 'br-2' };
  const otherBranchStats = store.handle(otherBranchAdmin, otherScope, req({ path: '/stats', query: { role: 'accountant' } }));
  assert.equal(otherBranchStats.status, 200);
  assert.equal(typeof otherBranchStats.body.data.billed, 'number');

  // student/parent ownership checks on /stats are unchanged: neither may ever request the accountant projection
  assert.equal(store.handle(hostUser('student'), scope, req({ path: '/stats', query: { role: 'accountant' } })).status, 403);
  assert.equal(store.handle(hostUser('parent'), scope, req({ path: '/stats', query: { role: 'accountant' } })).status, 403);
});
