document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  loadStats();
});

async function loadStats() {
  const [scholars, pending, verified, compliant, deficiency] = await Promise.all([
    supabase.from('scholars').select('*', { count: 'exact', head: true }),
    supabase.from('grade_submissions').select('*', { count: 'exact', head: true }).in('submission_status', ['Pending', 'For Verification']),
    supabase.from('grade_submissions').select('*', { count: 'exact', head: true }).eq('submission_status', 'Verified'),
    supabase.from('scholars').select('*', { count: 'exact', head: true }).eq('status', 'Compliant'),
    supabase.from('scholars').select('*', { count: 'exact', head: true }).eq('status', 'With Deficiency')
  ]);

  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><h3>${scholars.count || 0}</h3><p>Total Scholars</p></div>
    <div class="stat-card"><h3>${pending.count || 0}</h3><p>Pending Submissions</p></div>
    <div class="stat-card"><h3>${verified.count || 0}</h3><p>Verified Submissions</p></div>
    <div class="stat-card"><h3>${compliant.count || 0}</h3><p>Compliant Scholars</p></div>
    <div class="stat-card"><h3>${deficiency.count || 0}</h3><p>With Deficiency</p></div>
  `;
}