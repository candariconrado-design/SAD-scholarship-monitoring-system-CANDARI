document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  await loadScholarsDropdown();
  await loadPending();
  await loadAll();
});

async function loadScholarsDropdown() {
  const { data } = await supabase.from('scholars').select('id, student_id, full_name').order('full_name');
  const sel = document.getElementById('scholar_id');
  sel.innerHTML = '<option value="">-- Select Scholar --</option>';
  (data || []).forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.student_id} - ${s.full_name}</option>`;
  });
}

async function submitGrades() {
  const msg = document.getElementById('message');
  const scholar_id = document.getElementById('scholar_id').value;
  const academic_year = document.getElementById('academic_year').value.trim();
  const semester = document.getElementById('semester').value;
  const gwa = parseFloat(document.getElementById('gwa').value);
  const units_enrolled = parseInt(document.getElementById('units_enrolled').value);
  const failed_subjects = parseInt(document.getElementById('failed_subjects').value) || 0;
  const incomplete_subjects = parseInt(document.getElementById('incomplete_subjects').value) || 0;

  if (!scholar_id || !academic_year || isNaN(gwa) || isNaN(units_enrolled)) {
    msg.innerHTML = '<div class="alert alert-error">Please fill all required fields</div>';
    return;
  }
  if (gwa < 1 || gwa > 5) {
    msg.innerHTML = '<div class="alert alert-error">GWA must be between 1.00 and 5.00</div>';
    return;
  }
  if (units_enrolled < 0 || failed_subjects < 0 || incomplete_subjects < 0) {
    msg.innerHTML = '<div class="alert alert-error">Units and subject counts cannot be negative</div>';
    return;
  }

  const { error } = await supabase.from('grade_submissions').insert({
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
    msg.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
    return;
  }
  msg.innerHTML = '<div class="alert alert-success">Grades submitted as Pending</div>';
  document.getElementById('gwa').value = '';
  document.getElementById('units_enrolled').value = '';
  document.getElementById('failed_subjects').value = '0';
  document.getElementById('incomplete_subjects').value = '0';
  loadPending();
  loadAll();
}

async function loadPending() {
  const { data } = await supabase
    .from('grade_submissions')
    .select(`*, scholars(student_id, full_name)`)
    .in('submission_status', ['Pending', 'For Verification'])
    .order('submitted_at', { ascending: false });

  const tbody = document.getElementById('pendingTable');
  tbody.innerHTML = (data || []).map(g => `
    <tr>
      <td>${g.scholars?.student_id} - ${g.scholars?.full_name}</td>
      <td>${g.academic_year}</td>
      <td>${g.semester}</td>
      <td>${g.gwa}</td>
      <td>${g.units_enrolled}</td>
      <td>${g.failed_subjects}</td>
      <td>${g.submission_status}</td>
      <td><button class="btn btn-success" onclick="verifySubmission('${g.id}')">Verify</button></td>
    </tr>
  `).join('') || '<tr><td colspan="8">No pending submissions</td></tr>';
}

async function loadAll() {
  const { data } = await supabase
    .from('grade_submissions')
    .select(`*, scholars(student_id, full_name)`)
    .order('submitted_at', { ascending: false })
    .limit(50);

  const tbody = document.getElementById('allTable');
  tbody.innerHTML = (data || []).map(g => `
    <tr>
      <td>${g.scholars?.student_id} - ${g.scholars?.full_name}</td>
      <td>${g.academic_year}</td>
      <td>${g.semester}</td>
      <td>${g.gwa}</td>
      <td>${g.submission_status}</td>
      <td>${g.verified_at ? new Date(g.verified_at).toLocaleString() : '-'}</td>
    </tr>
  `).join('');
}

async function verifySubmission(id) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'staff' && profile.role !== 'admin')) {
    alert('Only staff/admin can verify submissions');
    return;
  }

  // Check if already verified
  const { data: existing } = await supabase.from('grade_submissions').select('submission_status').eq('id', id).single();
  if (existing?.submission_status === 'Verified') {
    alert('This submission is already verified');
    return;
  }

  const { error } = await supabase.from('grade_submissions').update({
    submission_status: 'Verified',
    verified_by: profile.id,
    verified_at: new Date().toISOString()
  }).eq('id', id);

  if (error) {
    alert(error.message);
    return;
  }

  // Immediately evaluate compliance
  await evaluateCompliance(id);
  loadPending();
  loadAll();
  alert('Submission verified and compliance evaluated');
}

async function evaluateCompliance(submissionId) {
  // Get submission + scholar + program
  const { data: sub } = await supabase
    .from('grade_submissions')
    .select(`*, scholars(*, scholarship_programs(*))`)
    .eq('id', submissionId)
    .single();

  if (!sub || sub.submission_status !== 'Verified') return;

  const prog = sub.scholars.scholarship_programs;
  if (!prog) return;

  // BR-11: lower GWA is better
  const gwaOk = sub.gwa <= prog.required_gwa;
  const unitsOk = sub.units_enrolled >= prog.min_units;
  const failOk = prog.allow_failing_grade || sub.failed_subjects === 0;

  const isCompliant = gwaOk && unitsOk && failOk;
  const newStatus = isCompliant ? 'Compliant' : 'With Deficiency';

  await supabase.from('scholars').update({ status: newStatus }).eq('id', sub.scholar_id);
}