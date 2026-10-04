document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  await loadStats();
});

function getCountResult(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.count || 0;
}

async function loadStats() {
  const status = document.getElementById('systemStatus');

  try {
    const results = await Promise.all([
      supabase.from('scholars')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Active'),

      supabase.from('grade_submissions')
        .select('id', { count: 'exact', head: true })
        .in('submission_status', ['Pending', 'For Verification']),

      supabase.from('grade_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('submission_status', 'Verified'),

      supabase.from('scholars')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Compliant'),

      supabase.from('scholars')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'With Deficiency')
    ]);

    const totalScholars = getCountResult(results[0], 'Total scholars');
    const pendingCount = getCountResult(results[1], 'Pending submissions');
    const verifiedCount = getCountResult(results[2], 'Verified submissions');
    const compliantCount = getCountResult(results[3], 'Compliant scholars');
    const deficiencyCount = getCountResult(results[4], 'Scholars with deficiency');

    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><h3>${totalScholars}</h3><p>Total Scholars</p></div>
      <div class="stat-card"><h3>${pendingCount}</h3><p>Pending Submissions</p></div>
      <div class="stat-card"><h3>${verifiedCount}</h3><p>Verified Submissions</p></div>
      <div class="stat-card"><h3>${compliantCount}</h3><p>Compliant Scholars</p></div>
      <div class="stat-card"><h3>${deficiencyCount}</h3><p>With Deficiency</p></div>
    `;

    status.innerHTML = totalScholars === 0
      ? `<p><strong>No active scholars yet.</strong></p>
         <p>Create a scholarship program first, then register a scholar.</p>`
      : `<p><strong>System is running normally.</strong></p>
         <p>• ${totalScholars} active scholar(s)<br>
         • ${pendingCount} submission(s) waiting for verification<br>
         • ${compliantCount} compliant • ${deficiencyCount} with deficiency</p>`;

  } catch (error) {
    console.error('Dashboard error:', error);
    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><h3>—</h3><p>Total Scholars</p></div>
      <div class="stat-card"><h3>—</h3><p>Pending Submissions</p></div>
      <div class="stat-card"><h3>—</h3><p>Verified Submissions</p></div>
      <div class="stat-card"><h3>—</h3><p>Compliant Scholars</p></div>
      <div class="stat-card"><h3>—</h3><p>With Deficiency</p></div>`;
    status.innerHTML = `<p style="color:#b91c1c"><strong>Unable to load dashboard data.</strong></p><p>${escapeHtml(error.message)}</p>`;
  }
}