document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth(['admin', 'staff']);
  if (!session) return;

  await loadScholarsDropdown();
  await loadPending();
  await loadAll();
});

async function loadScholarsDropdown() {
  const { data, error } = await sb
    .from('scholars')
    .select('id, student_id, full_name')
    .order('full_name');

  const sel = document.getElementById('scholar_id');

  if (error) {
    sel.innerHTML = '<option value="">Unable to load scholars</option>';
    showMessage('message', `Unable to load scholars: ${error.message}`);
    return;
  }

  sel.innerHTML = '<option value="">-- Select Scholar --</option>';
  (data || []).forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${escapeHtml(s.student_id)} - ${escapeHtml(s.full_name)}</option>`;
  });
}

async function submitGrades() {
  const scholar_id = document.getElementById('scholar_id').value;
  const academic_year = document.getElementById('academic_year').value.trim();
  const semester = document.getElementById('semester').value;
  const gwa = Number.parseFloat(document.getElementById('gwa').value);
  const units_enrolled = Number.parseInt(document.getElementById('units_enrolled').value, 10);
  const failed_subjects = Number.parseInt(document.getElementById('failed_subjects').value, 10);
  const incomplete_subjects = Number.parseInt(document.getElementById('incomplete_subjects').value, 10);

  if (!scholar_id || !academic_year || !semester || Number.isNaN(gwa) || Number.isNaN(units_enrolled)) {
    showMessage('message', 'Please fill all required fields.');
    return;
  }

  if (gwa < 1 || gwa > 5) {
    showMessage('message', 'GWA must be between 1.00 and 5.00.');
    return;
  }

  if (units_enrolled < 0 || failed_subjects < 0 || incomplete_subjects < 0) {
    showMessage('message', 'Units and subject counts cannot be negative.');
    return;
  }

  const { data: scholar, error: scholarError } = await sb
    .from('scholars')
    .select('id')
    .eq('id', scholar_id)
    .single();

  if (scholarError || !scholar) {
    showMessage('message', 'Selected scholar was not found.');
    return;
  }

  const { data: existing, error: duplicateError } = await sb
    .from('grade_submissions')
    .select('id, submission_status')
    .eq('scholar_id', scholar_id)
    .eq('academic_year', academic_year)
    .eq('semester', semester)
    .limit(1);

  if (duplicateError) {
    showMessage('message', `Unable to check existing submission: ${duplicateError.message}`);
    return;
  }

  if (existing?.length) {
    showMessage('message', 'A grade submission already exists for this scholar, academic year, and semester.');
    return;
  }

  const { error } = await sb.from('grade_submissions').insert({
    scholar_id,
    academic_year,
    semester,
    gwa,
    units_enrolled,
    failed_subjects,
    incomplete_subjects,
    submission_status: 'Pending'
  });

  if (error) {
    showMessage('message', error.message);
    return;
  }

  showMessage('message', 'Grades submitted as Pending / For Verification.', 'success');
  document.getElementById('gwa').value = '';
  document.getElementById('units_enrolled').value = '';
  document.getElementById('failed_subjects').value = '0';
  document.getElementById('incomplete_subjects').value = '0';

  await loadPending();
  await loadAll();
}

async function loadPending() {
  const { data, error } = await sb
    .from('grade_submissions')
    .select('id, academic_year, semester, gwa, units_enrolled, failed_subjects, submission_status, scholars(student_id, full_name)')
    .in('submission_status', ['Pending', 'For Verification'])
    .order('submitted_at', { ascending: false });

  const tbody = document.getElementById('pendingTable');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  tbody.innerHTML = (data || []).map(g => `
    <tr>
      <td>${escapeHtml(g.scholars?.student_id || '-')} - ${escapeHtml(g.scholars?.full_name || '-')}</td>
      <td>${escapeHtml(g.academic_year)}</td>
      <td>${escapeHtml(g.semester)}</td>
      <td>${g.gwa}</td>
      <td>${g.units_enrolled}</td>
      <td>${g.failed_subjects}</td>
      <td>${escapeHtml(g.submission_status)}</td>
      <td><button class="btn btn-success" onclick="verifySubmission('${g.id}')">Verify</button></td>
    </tr>`).join('') ||
    '<tr><td colspan="8">No pending submissions</td></tr>';
}

async function loadAll() {
  const { data, error } = await sb
    .from('grade_submissions')
    .select('id, academic_year, semester, gwa, submission_status, verified_at, scholars(student_id, full_name)')
    .order('submitted_at', { ascending: false })
    .limit(50);

  const tbody = document.getElementById('allTable');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  tbody.innerHTML = (data || []).map(g => `
    <tr>
      <td>${escapeHtml(g.scholars?.student_id || '-')} - ${escapeHtml(g.scholars?.full_name || '-')}</td>
      <td>${escapeHtml(g.academic_year)}</td>
      <td>${escapeHtml(g.semester)}</td>
      <td>${g.gwa}</td>
      <td>${escapeHtml(g.submission_status)}</td>
      <td>${g.verified_at ? new Date(g.verified_at).toLocaleString() : '-'}</td>
    </tr>`).join('') ||
    '<tr><td colspan="6">No submissions yet</td></tr>';
}

async function verifySubmission(id) {
  const profile = await getCurrentProfile();

  if (!profile || !['staff', 'admin'].includes(profile.role)) {
    alert('Only staff/admin can verify submissions.');
    return;
  }

  const { data: existing, error: lookupError } = await sb
    .from('grade_submissions')
    .select('id, submission_status')
    .eq('id', id)
    .single();

  if (lookupError || !existing) {
    alert(lookupError?.message || 'Submission not found.');
    return;
  }

  if (existing.submission_status === 'Verified') {
    alert('This submission is already verified.');
    return;
  }

  if (!['Pending', 'For Verification'].includes(existing.submission_status)) {
    alert('Only pending submissions can be verified.');
    return;
  }

  const { error } = await sb
    .from('grade_submissions')
    .update({
      submission_status: 'Verified',
      verified_by: profile.id,
      verified_at: new Date().toISOString()
    })
    .eq('id', id)
    .in('submission_status', ['Pending', 'For Verification']);

  if (error) {
    alert(`Verification failed: ${error.message}`);
    return;
  }

  const evaluation = await evaluateCompliance(id);

  if (!evaluation.success) {
    alert(`Submission verified, but compliance evaluation failed: ${evaluation.message}`);
  } else {
    alert(`Submission verified. Result: ${evaluation.status}`);
  }

  await loadPending();
  await loadAll();
}

async function evaluateCompliance(submissionId) {
  const { data: sub, error: subError } = await sb
    .from('grade_submissions')
    .select('id, scholar_id, gwa, units_enrolled, failed_subjects, incomplete_subjects, submission_status, scholars(id, scholarship_id, scholarship_programs(id, required_gwa, min_units, allow_failing_grade))')
    .eq('id', submissionId)
    .single();

  if (subError || !sub) {
    return { success: false, message: subError?.message || 'Submission not found.' };
  }

  if (sub.submission_status !== 'Verified') {
    return { success: false, message: 'Only verified submissions can be evaluated.' };
  }

  const program = sub.scholars?.scholarship_programs;

  if (!program) {
    return { success: false, message: 'Scholar has no valid scholarship program.' };
  }

  const gwaOk = Number(sub.gwa) <= Number(program.required_gwa);
  const unitsOk = Number(sub.units_enrolled) >= Number(program.min_units);
  const failOk = Boolean(program.allow_failing_grade) || Number(sub.failed_subjects) === 0;

  const isCompliant = gwaOk && unitsOk && failOk;
  const newStatus = isCompliant ? 'Compliant' : 'With Deficiency';

  const { error: updateError } = await sb
    .from('scholars')
    .update({ status: newStatus })
    .eq('id', sub.scholar_id);

  if (updateError) {
    return { success: false, message: updateError.message };
  }

  return { success: true, status: newStatus };
}
