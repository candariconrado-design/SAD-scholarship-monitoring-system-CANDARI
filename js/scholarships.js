document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  loadPrograms();
});

async function loadPrograms() {
  const { data, error } = await supabase.from('scholarship_programs').select('*').order('program_name');
  const tbody = document.getElementById('programTable');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    return;
  }
  tbody.innerHTML = (data || []).map(p => `
    <tr>
      <td>${p.program_name}</td>
      <td>${p.required_gwa}</td>
      <td>${p.min_units}</td>
      <td>${p.allow_failing_grade ? 'Yes' : 'No'}</td>
      <td>${p.active ? 'Yes' : 'No'}</td>
      <td><button class="btn" onclick='editProgram(${JSON.stringify(p)})'>Edit</button></td>
    </tr>
  `).join('') || '<tr><td colspan="6">No programs yet</td></tr>';
}

function editProgram(p) {
  document.getElementById('editId').value = p.id;
  document.getElementById('program_name').value = p.program_name;
  document.getElementById('required_gwa').value = p.required_gwa;
  document.getElementById('min_units').value = p.min_units;
  document.getElementById('allow_failing_grade').value = p.allow_failing_grade ? 'true' : 'false';
  document.getElementById('active').value = p.active ? 'true' : 'false';
}

function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('program_name').value = '';
  document.getElementById('required_gwa').value = '';
  document.getElementById('min_units').value = '';
  document.getElementById('allow_failing_grade').value = 'false';
  document.getElementById('active').value = 'true';
  document.getElementById('message').innerHTML = '';
}

async function saveProgram() {
  const msg = document.getElementById('message');
  const id = document.getElementById('editId').value;
  const program_name = document.getElementById('program_name').value.trim();
  const required_gwa = parseFloat(document.getElementById('required_gwa').value);
  const min_units = parseInt(document.getElementById('min_units').value);
  const allow_failing_grade = document.getElementById('allow_failing_grade').value === 'true';
  const active = document.getElementById('active').value === 'true';

  if (!program_name || isNaN(required_gwa) || isNaN(min_units)) {
    msg.innerHTML = '<div class="alert alert-error">All fields are required</div>';
    return;
  }

  const payload = { program_name, required_gwa, min_units, allow_failing_grade, active };
  let result;
  if (id) {
    result = await supabase.from('scholarship_programs').update(payload).eq('id', id);
  } else {
    result = await supabase.from('scholarship_programs').insert(payload);
  }

  if (result.error) {
    msg.innerHTML = `<div class="alert alert-error">Error: ${result.error.message}</div>`;
    return;
  }
  msg.innerHTML = '<div class="alert alert-success">Program saved successfully!</div>';
  resetForm();
  loadPrograms();
}