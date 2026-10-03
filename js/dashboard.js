document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth();
  loadStats();
});

async function loadStats() {
  try {
    const [scholars, pending, verified, compliant, deficiency] = await Promise.all([
      supabase.from('scholars').select('*', { count: 'exact', head: true }),
      supabase.from('grade_submissions').select('*', { count: 'exact', head: true }).in('submission_status', ['Pending', 'For Verification']),
      supabase.from('grade_submissions').select('*', { count: 'exact', head: true }).eq('submission_status', 'Verified'),
      supabase.from('scholars').select('*', { count: 'exact', head: true }).eq('status', 'Compliant'),
      supabase.from('scholars').select('*', { count: 'exact', head: true }).eq('status', 'With Deficiency')
    ]);

    const totalScholars = scholars.count || 0;
    const pendingCount = pending.count || 0;
    const verifiedCount = verified.count || 0;
    const compliantCount = compliant.count || 0;
    const deficiencyCount = deficiency.count || 0;

    document.getElementById('stats').innerHTML = `
      <div class="stat-card">
        <h3>${totalScholars}</h3>
        <p>Total Scholars</p>
      </div>
      <div class="stat-card">
        <h3>${pendingCount}</h3>
        <p>Pending Submissions</p>
      </div>
      <div class="stat-card">
        <h3>${verifiedCount}</h3>
        <p>Verified Submissions</p>
      </div>
      <div class="stat-card">
        <h3>${compliantCount}</h3>
        <p>Compliant Scholars</p>
      </div>
      <div class="stat-card">
        <h3>${deficiencyCount}</h3>
        <p>With Deficiency</p>
      </div>
    `;

    // System status message
    let statusMsg = '';
    if (totalScholars === 0) {
      statusMsg = `
        <p><strong>No data yet.</strong></p>
        <p>Go to <strong>Scholarship Programs</strong> → create a program first.<br>
        Then go to <strong>Scholars</strong> → register scholars.<br>
        After that you can submit grades and verify them.</p>
      `;
    } else {
      statusMsg = `
        <p>System is running normally.</p>
        <p>
          • ${totalScholars} scholar(s) registered<br>
          • ${pendingCount} submission(s) waiting for verification<br>
          • ${compliantCount} compliant • ${deficiencyCount} with deficiency
        </p>
      `;
    }
    document.getElementById('systemStatus').innerHTML = statusMsg;

  } catch (err) {
    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><h3>0</h3><p>Total Scholars</p></div>
      <div class="stat-card"><h3>0</h3><p>Pending Submissions</p></div>
      <div class="stat-card"><h3>0</h3><p>Verified Submissions</p></div>
      <div class="stat-card"><h3>0</h3><p>Compliant Scholars</p></div>
      <div class="stat-card"><h3>0</h3><p>With Deficiency</p></div>
    `;
    document.getElementById('systemStatus').innerHTML = `
      <p style="color:#b91c1c"><strong>Error loading data:</strong> ${err.message}</p>
      <p>Check your internet connection or Supabase configuration.</p>
    `;
  }
}
