document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth(['admin', 'staff']);
  if (!session) return;
  await loadProgramsDropdown();
  await loadScholars();
  document.getElementById('search')?.addEventListener('input', loadScholars);
  document.getElementById('filterProgram')?.addEventListener('change', loadScholars);
  document.getElementById('filterStatus')?.addEventListener('change', loadScholars);
});

async function loadProgramsDropdown() {
  const { data, error } = await sb.from('scholarship_programs')
    .select('id, program_name').eq('active', true).order('program_name');
  if (error) { showMessage('message', `Unable to load programs: ${error.message}`); return; }
  const sel = document.getElementById('scholarship_id');
  const filter = document.getElementById('filterProgram');
  sel.innerHTML = '<option value="">-- Select Scholarship --</option>';
  const currentFilter = filter.value;
  filter.innerHTML = '<option value="">All Programs</option>';
  (data || []).forEach(p => {
    sel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p.id)}">${escapeHtml(p.program_name)}</option>`);
    filter.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p.id)}">${escapeHtml(p.program_name)}</option>`);
  });
  filter.value = currentFilter;
}

async function loadScholars() {
  const search = document.getElementById('search')?.value.trim().toLowerCase() || '';
  const programFilter = document.getElementById('filterProgram')?.value || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';
  let query = sb.from('scholars')
    .select('id, student_id, full_name, degree_program, year_level, scholarship_id, status, scholarship_programs(program_name)')
    .order('full_name');
  if (statusFilter) query = query.eq('status', statusFilter);
  if (programFilter) query = query.eq('scholarship_id', programFilter);
  const { data, error } = await query;
  const tbody = document.getElementById('scholarTable');
  if (error) { tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`; return; }
  const filtered = (data || []).filter(s => !search ||
    String(s.student_id).toLowerCase().includes(search) || String(s.full_name).toLowerCase().includes(search));
  tbody.innerHTML = filtered.map(s => `
    <tr><td>${escapeHtml(s.student_id)}</td><td>${escapeHtml(s.full_name)}</td>
    <td>${escapeHtml(s.degree_program)}</td><td>${s.year_level}</td>
    <td>${escapeHtml(s.scholarship_programs?.program_name || '-')}</td>
    <td><span class="status-pill ${s.status === 'Compliant' ? 'success' : s.status === 'With Deficiency' ? 'danger' : 'neutral'}">${escapeHtml(s.status)}</span></td>
    <td><button class="btn btn-small" onclick='editScholar(${JSON.stringify(s).replace(/</g, '\\u003c')})'>Edit</button></td></tr>`).join('') ||
    '<tr><td colspan="7" class="empty-state">No scholars match your search.</td></tr>';
}

function editScholar(s) {
  document.getElementById('editId').value = s.id;
  document.getElementById('student_id').value = s.student_id || '';
  document.getElementById('full_name').value = s.full_name || '';
  document.getElementById('degree_program').value = s.degree_program || '';
  document.getElementById('year_level').value = s.year_level || '';
  document.getElementById('scholarship_id').value = s.scholarship_id || '';
  document.getElementById('formTitle').textContent = 'Edit Scholar';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function resetForm() {
  document.getElementById('editId').value = '';
  ['student_id','full_name','degree_program','year_level'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('scholarship_id').value = '';
  document.getElementById('formTitle').textContent = 'Register New Scholar';
  document.getElementById('message').innerHTML = '';
}

async function saveScholar() {
  const id = document.getElementById('editId').value;
  const student_id = document.getElementById('student_id').value.trim();
  const full_name = document.getElementById('full_name').value.trim();
  const degree_program = document.getElementById('degree_program').value.trim();
  const year_level = Number(document.getElementById('year_level').value);
  const scholarship_id = document.getElementById('scholarship_id').value;
  if (!student_id || !full_name || !degree_program || !scholarship_id) {
    showMessage('message', 'Student ID, name, degree program, and scholarship are required.'); return;
  }
  if (!Number.isInteger(year_level) || year_level < 1 || year_level > 5) {
    showMessage('message', 'Year level must be a whole number from 1 to 5.'); return;
  }
  const { data: program, error: programError } = await sb.from('scholarship_programs')
    .select('id, active').eq('id', scholarship_id).single();
  if (programError || !program?.active) { showMessage('message', 'Select an existing active scholarship program.'); return; }
  const duplicateQuery = sb.from('scholars').select('id').eq('student_id', student_id);
  if (id) duplicateQuery.neq('id', id);
  const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1);
  if (duplicateError) { showMessage('message', duplicateError.message); return; }
  if (duplicate?.length) { showMessage('message', 'Student ID already exists.'); return; }

  const payload = { student_id, full_name, degree_program, year_level, scholarship_id };
  const result = id ? await sb.from('scholars').update(payload).eq('id', id) :
    await sb.from('scholars').insert({ ...payload, status: 'Active' });
  if (result.error) { showMessage('message', result.error.message); return; }
  showMessage('message', 'Scholar saved. Status is controlled by verified academic evaluations.', 'success');
  resetForm();
  await loadScholars();
}
