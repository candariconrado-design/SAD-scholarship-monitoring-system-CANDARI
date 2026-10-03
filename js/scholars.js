document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  await loadProgramsDropdown();
  await loadScholars();
});

async function loadProgramsDropdown() {
  const { data } = await supabase
    .from('scholarship_programs')
    .select('id, program_name')
    .eq('active', true)
    .order('program_name');

  const sel = document.getElementById('scholarship_id');
  const filterSel = document.getElementById('filterProgram');

  let options = '<option value="">-- Select Scholarship --</option>';
  let filterOptions = '<option value="">All Programs</option>';

  (data || []).forEach(p => {
    options += `<option value="${p.id}">${p.program_name}</option>`;
    filterOptions += `<option value="${p.id}">${p.program_name}</option>`;
  });

  if (sel) sel.innerHTML = options;
  if (filterSel) filterSel.innerHTML = filterOptions;
}

async function loadScholars() {
  const search = document.getElementById('search')?.value.trim() || '';
  const programFilter = document.getElementById('filterProgram')?.value || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';

  let query = supabase
    .from('scholars')
    .select(`*, scholarship_programs(program_name)`)
    .order('full_name');

  if (statusFilter) query = query.eq('status', statusFilter);
  if (programFilter) query = query.eq('scholarship_id', programFilter);

  const { data, error } = await query;
  const tbody = document.getElementById('scholarTable');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
    return;
  }

  let filtered = data || [];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(sch =>
      (sch.student_id || '').toLowerCase().includes(s) ||
      (sch.full_name || '').toLowerCase().includes(s)
    );
  }

  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${s.student_id}</td>
      <td>${s.full_name}</td>
      <td>${s.degree_program}</td>
      <td>${s.year_level}</td>
      <td>${s.scholarship_programs?.program_name || '-'}</td>
      <td><strong>${s.status}</strong></td>
      <td>
        <button class="btn" style="padding:6px 12px;font-size:13px" onclick='editScholar(${JSON.stringify(s)})'>Edit</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:30px">No scholars found</td></tr>';
}

function editScholar(s) {
  document.getElementById('editId').value = s.id;
  document.getElementById('student_id').value = s.student_id;
  document.getElementById('full_name').value = s.full_name;
  document.getElementById('degree_program').value = s.degree_program;
  document.getElementById('year_level').value = s.year_level;
  document.getElementById('scholarship_id').value = s.scholarship_id || '';
  document.getElementById('status').value = s.status;
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
  const year_level = parseInt(document.getElementById('year_level').value);
  const scholarship_id = document.getElementById('scholarship_id').value;
  const status = document.getElementById('status').value;

  if (!student_id || !full_name || !degree_program || !year_level || !scholarship_id) {
    msg.innerHTML = '<div class="alert alert-error">Please fill all required fields</div>';
    return;
  }

  const payload = { student_id, full_name, degree_program, year_level, scholarship_id, status };

  let result;
  if (id) {
    result = await supabase.from('scholars').update(payload).eq('id', id);
  } else {
    result = await supabase.from('scholars').insert(payload);
  }

  if (result.error) {
    msg.innerHTML = `<div class="alert alert-error">${result.error.message}</div>`;
    return;
  }

  msg.innerHTML = '<div class="alert alert-success">Scholar saved successfully!</div>';
  resetForm();
  loadScholars();
}
