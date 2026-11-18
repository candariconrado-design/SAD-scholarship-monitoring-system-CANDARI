document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth(['admin', 'staff']);
  if (!session) return;
  await loadScholarsDropdown();
  await loadPending();
  await loadAll();
});

async function loadScholarsDropdown() {
  const { data, error } = await sb.from('scholars')
    .select('id, student_id, full_name').order('full_name');
  const sel = document.getElementById('scholar_id');
  if (error) {
    sel.innerHTML = '<option value="">Unable to load scholars</option>';
    showMessage('message', `Unable to load scholars: ${error.message}`);
    return;
  }
  sel.innerHTML = '<option value="">-- Select Scholar --</option>';
  (data || []).forEach(s => {
    sel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(s.id)}">${escapeHtml(s.student_id)} — ${escapeHtml(s.full_name)}</option>`);
  });
}

async function submitGrades() {
  const scholar_id = document.getElementById('scholar_id').value;
  const academic_year = document.getElementById('academic_year').value.trim();
  const semester = document.getElementById('semester').value;
  const gwaRaw = document.getElementById('gwa').value;
  const unitsRaw = document.getElementById('units_enrolled').value;
  const failedRaw = document.getElementById('failed_subjects').value;
  const incompleteRaw = document.getElementById('incomplete_subjects').value;
  const gwa = Number(gwaRaw), units_enrolled = Number(unitsRaw);
  const failed_subjects = Number(failedRaw || 0), incomplete_subjects = Number(incompleteRaw || 0);

  if (!scholar_id || !/^\d{4}-\d{4}$/.test(academic_year) || !semester || gwaRaw === '' || unitsRaw === '') {
    showMessage('message', 'Select a scholar and enter a valid academic year (YYYY-YYYY), semester, GWA, and units.');
    return;
  }
  if (![gwa, units_enrolled, failed_subjects, incomplete_subjects].every(Number.isFinite)) {
    showMessage('message', 'Enter valid numeric values only.'); return;
  }
  if (gwa < 1 || gwa > 5 || !Number.isInteger(units_enrolled) || units_enrolled < 0 ||
      !Number.isInteger(failed_subjects) || failed_subjects < 0 ||
      !Number.isInteger(incomplete_subjects) || incomplete_subjects < 0) {
    showMessage('message', 'GWA must be 1.00–5.00. Units and subject counts must be non-negative whole numbers.');
    return;
  }
  const [startYear, endYear] = academic_year.split('-').map(Number);
  if (endYear !== startYear + 1) {
    showMessage('message', 'Academic year must be consecutive (example: 2025-2026).'); return;
  }

  const { data: existing, error: duplicateError } = await sb.from('grade_submissions')
    .select('id').eq('scholar_id', scholar_id).eq('academic_year', academic_year).eq('semester', semester).limit(1);
  if (duplicateError) { showMessage('message', duplicateError.message); return; }
  if (existing?.length) { showMessage('message', 'A submission already exists for this scholar, academic year, and semester.'); return; }

  const { error } = await sb.from('grade_submissions').insert({
    scholar_id, academic_year, semester, gwa, units_enrolled, failed_subjects,
    incomplete_subjects, submission_status: 'Pending'
  });
  if (error) { showMessage('message', error.message); return; }
  showMessage('message', 'Grade submission saved with Pending status.', 'success');
  ['gwa','units_enrolled'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('failed_subjects').value = '0';
  document.getElementById('incomplete_subjects').value = '0';
  await Promise.all([loadPending(), loadAll()]);
}

async function loadPending() {
  const { data, error } = await sb.from('grade_submissions')
    .select('id, academic_year, semester, gwa, units_enrolled, failed_subjects, incomplete_subjects, submission_status, scholars(student_id, full_name)')
    .in('submission_status', ['Pending', 'For Verification']).order('submitted_at', { ascending: false });
  const tbody = document.getElementById('pendingTable');
  if (error) { tbody.innerHTML = `<tr><td colspan="9">${escapeHtml(error.message)}</td></tr>`; return; }
  tbody.innerHTML = (data || []).map(g => `
    <tr><td>${escapeHtml(g.scholars?.student_id || '-')} — ${escapeHtml(g.scholars?.full_name || '-')}</td>
    <td>${escapeHtml(g.academic_year)}</td><td>${escapeHtml(g.semester)}</td><td>${Number(g.gwa).toFixed(2)}</td>
    <td>${g.units_enrolled}</td><td>${g.failed_subjects}</td><td>${g.incomplete_subjects ?? 0}</td>
    <td><span class="status-pill pending">${escapeHtml(g.submission_status)}</span></td>
    <td><button class="btn btn-success" onclick="verifySubmission('${escapeHtml(g.id)}')">Verify</button></td></tr>`).join('') ||
    '<tr><td colspan="9" class="empty-state">No pending submissions</td></tr>';
}

async function loadAll() {
  const { data, error } = await sb.from('grade_submissions')
    .select('id, academic_year, semester, gwa, submission_status, verified_at, submitted_at, scholars(student_id, full_name)')
    .order('submitted_at', { ascending: false }).limit(100);
  const tbody = document.getElementById('allTable');
  if (error) { tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`; return; }
  tbody.innerHTML = (data || []).map(g => `
    <tr><td>${escapeHtml(g.scholars?.student_id || '-')} — ${escapeHtml(g.scholars?.full_name || '-')}</td>
    <td>${escapeHtml(g.academic_year)}</td><td>${escapeHtml(g.semester)}</td><td>${Number(g.gwa).toFixed(2)}</td>
    <td><span class="status-pill ${g.submission_status === 'Verified' ? 'success' : 'pending'}">${escapeHtml(g.submission_status)}</span></td>
    <td>${g.verified_at ? new Date(g.verified_at).toLocaleString() : '—'}</td></tr>`).join('') ||
    '<tr><td colspan="6" class="empty-state">No submissions yet</td></tr>';
}

async function verifySubmission(id) {
  const profile = await getCurrentProfile();
  if (!profile || !['staff', 'admin'].includes(profile.role)) { showMessage('message', 'Only authorized staff/admin can verify submissions.'); return; }
  const { data: existing, error: lookupError } = await sb.from('grade_submissions')
    .select('id, submission_status').eq('id', id).single();
  if (lookupError || !existing) { showMessage('message', lookupError?.message || 'Submission not found.'); return; }
  if (existing.submission_status === 'Verified') { showMessage('message', 'This submission has already been verified.'); return; }
  if (!['Pending', 'For Verification'].includes(existing.submission_status)) { showMessage('message', 'Only pending submissions can be verified.'); return; }

  const { data: updated, error } = await sb.from('grade_submissions').update({
    submission_status: 'Verified', verified_by: profile.id, verified_at: new Date().toISOString()
  }).eq('id', id).in('submission_status', ['Pending', 'For Verification']).select('id').maybeSingle();
  if (error || !updated) { showMessage('message', error?.message || 'Submission was changed by another user. Refresh and try again.'); return; }

  const evaluation = await evaluateCompliance(id);
  if (!evaluation.success) showMessage('message', `Verified, but evaluation failed: ${evaluation.message}`);
  else showMessage('message', `Verified. Result: ${evaluation.status}. ${evaluation.reasons.join(' ')}`, evaluation.status === 'Compliant' ? 'success' : 'error');
  await Promise.all([loadPending(), loadAll()]);
}

async function evaluateCompliance(submissionId) {
  const { data: sub, error } = await sb.from('grade_submissions')
    .select('id, scholar_id, gwa, units_enrolled, failed_subjects, incomplete_subjects, submission_status, scholars(id, scholarship_id, scholarship_programs(id, required_gwa, min_units, allow_failing_grade))')
    .eq('id', submissionId).single();
  if (error || !sub) return { success: false, message: error?.message || 'Submission not found.' };
  if (sub.submission_status !== 'Verified') return { success: false, message: 'Only verified submissions can be evaluated.' };
  const program = sub.scholars?.scholarship_programs;
  if (!program) return { success: false, message: 'Scholar has no valid scholarship program.' };

  const reasons = [];
  if (Number(sub.gwa) > Number(program.required_gwa)) reasons.push(`GWA ${sub.gwa} is above the required ${program.required_gwa}.`);
  if (Number(sub.units_enrolled) < Number(program.min_units)) reasons.push(`Units ${sub.units_enrolled} are below the minimum ${program.min_units}.`);
  if (!program.allow_failing_grade && Number(sub.failed_subjects) > 0) reasons.push('Failing subjects are not allowed by this scholarship.');
  if (Number(sub.incomplete_subjects || 0) > 0) reasons.push('Incomplete subjects must be cleared before compliance can be granted.');
  const status = reasons.length ? 'With Deficiency' : 'Compliant';

  const { error: updateError } = await sb.from('scholars').update({ status }).eq('id', sub.scholar_id);
  if (updateError) return { success: false, message: updateError.message };
  const profile = await getCurrentProfile();
  const { error: historyError } = await sb.from('compliance_evaluations').insert({
    scholar_id: sub.scholar_id,
    grade_submission_id: sub.id,
    scholarship_program_id: program.id,
    evaluation_status: status,
    deficiency_reasons: reasons,
    evaluated_by: profile?.id || null
  });
  if (historyError) return { success: false, message: 'Status updated, but evaluation history could not be saved: ' + historyError.message };
  return { success: true, status, reasons: reasons.length ? reasons : ['All configured academic conditions were met.'] };
}
