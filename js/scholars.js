document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth(['admin', 'staff']);
  if (!session) return;

  await loadProgramsDropdown();
  await loadScholars();
});

async function loadProgramsDropdown() {
  const { data, error } = await supabase
    .from('scholarship_programs')
    .select('id, program_name')
    .eq('active', true)
    .order('program_name');

  if (error) {
    showMessage('message', `Unable to load scholarship programs: ${error.message}`);
    return;
  }

  const sel = document.getElementById('scholarship_id');
  const filterSel = document.getElementById('filterProgram');

  const options = ['<option value="">-- Select Scholarship --</option>'];
  const filterOptions = ['<option value="">All Programs</option>'];

  (data || []).forEach(p => {
    const name = escapeHtml(p.program_name);
    options.push(`<option value="${p.id}">${name}</option>`);
    filterOptions.push(`<option value="${p.id}">${name}</option>`);
  });

  if (sel) sel.innerHTML = options.join('');
  if (filterSel) filterSel.innerHTML = filterOptions.join('');
}

async function loadScholars() {
  const search = document.getElementById('search')?.value.trim().toLowerCase() || '';
  const programFilter = document.getElementById('filterProgram')?.value || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';

  let query = supabase
    .from('scholars')
    .select('id, student_id, full_name, degree_program, year_level, scholarship_id, status, scholarship_programs(program_name)')
    .order('full_name');

  if (statusFilter) query = query.eq('status', statusFilter);
  if (programFilter) query = query.eq('scholarship_id', programFilter);

  const { data, error } = await query;
  const tbody = document.getElementById('scholarTable');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  const filtered = (data || []).filter(sch =>
    !search ||
    String(sch.student_id || '').toLowerCase().includes(search) ||
    String(sch.full_name || '').toLowerCase().includes(search)
  );

  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${escapeHtml(s.student_id)}</td>
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.degree_program)}</td>
      <td>${s.year_level}</td>
      <td>${escapeHtml(s.scholarship_programs?.program_name || '-')}</td>
      <td><strong>${escapeHtml(s.status)}</strong></td>
      <td><button class="btn" style="padding:6px 12px;font-size:13px" onclick='editScholar(${JSON.stringify(s).replace(/'/g, '&#039;')})'>Edit</button></td>
    </tr>`).join('') ||
    '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px">No scholars found</td></tr>';
}

function editScholar(s) {
  document.getElementById('editId').value = s.id;
  document.getElementById('student_id').value = s.student_id || '';
  document.getElementById('full_name').value = s.full_name || '';
  document.getElementById('degree_program').value = s.degree_program || '';
  document.getElementById('year_level').value = s.year_level || '';
  document.getElementById('scholarship_id').value = s.scholarship_id || '';
  document.getElementById('status').value = s.status || 'Active';
  document.getElementById('formTitle').textContent = 'Edit Scholar';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('student_id').value = '';
  document.getElementById('full_name').value = '';
  document.getElementById('degree_program').value = '';
  document.getElementById('year_level').value = '';
  document.getElementById('scholarship_id').value = '';
  document.getElementById('status').value = 'Active';
  document.getElementById('formTitle').textContent = 'Register New Scholar';
  document.getElementById('message').innerHTML = '';
}

async function saveScholar() {
  const msg = document.getElementById('message');
  const id = document.getElementById('editId').value;
  const student_id = document.getElementById('student_id').value.trim();
  const full_name = document.getElementById('full_name').value.trim();
  const degree_program = document.getElementById('degree_program').value.trim();
  const year_level = Number.parseInt(document.getElementById('year_level').value, 10);
  const scholarship_id = document.getElementById('scholarship_id').value;
  const status = document.getElementById('status').value;

  if (!student_id || !full_name || !degree_program || !scholarship_id) {
    showMessage('message', 'Student ID, Full Name, Degree Program, and Scholarship Program are required.');
    return;
  }

  if (!Number.isInteger(year_level) || year_level < 1 || year_level > 5) {
    showMessage('message', 'Year Level must be between 1 and 5.');
    return;
  }

  const { data: program, error: programError } = await supabase
    .from('scholarship_programs')
    .select('id, active')
    .eq('id', scholarship_id)
    .single();

  if (programError || !program) {
    showMessage('message', 'The selected scholarship program could not be found.');
    return;
  }

  if (!program.active) {
    showMessage('message', 'Only active scholarship programs can be assigned.');
    return;
  }

  const duplicateQuery = supabase
    .from('scholars')
    .select('id')
    .eq('student_id', student_id);

  if (id) duplicateQuery.neq('id', id);

  const { data: duplicate, error: duplicateError } = await duplicateQuery.limit(1);
  if (duplicateError) {
    showMessage('message', `Unable to validate Student ID: ${duplicateError.message}`);
    return;
  }

  if (duplicate?.length) {
    showMessage('message', 'Student ID already exists.');
    return;
  }

  const payload = { student_id, full_name, degree_program, year_level, scholarship_id, status };

  const result = id
    ? await supabase.from('scholars').update(payload).eq('id', id)
    : await supabase.from('scholars').insert(payload);

  if (result.error) {
    showMessage('message', result.error.message);
    return;
  }

  showMessage('message', 'Scholar saved successfully!', 'success');
  resetForm();
  await loadScholars();
}