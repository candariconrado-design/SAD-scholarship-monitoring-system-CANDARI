async function requireAuth(allowedRoles = ['admin', 'staff']) {
  try {
    const { data: { session }, error } = await sb.auth.getSession();

    if (error) throw error;

    if (!session) {
      window.location.href = 'login.html';
      return null;
    }

    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      const profile = await getCurrentProfile();

      if (!profile) {
        await sb.auth.signOut();
        window.location.href = 'login.html';
        return null;
      }

      if (!allowedRoles.includes(profile.role)) {
        document.body.innerHTML = `
          <div class="container" style="margin-top:80px;">
            <div class="card">
              <h1>Access Denied</h1>
              <p>You are not authorized to access this page.</p>
              <button class="btn" onclick="window.location.href='dashboard.html'">Back to Dashboard</button>
            </div>
          </div>
        `;
        return null;
      }
    }

    return session;
  } catch (error) {
    console.error('Authentication error:', error);
    window.location.href = 'login.html';
    return null;
  }
}

async function logout() {
  try {
    const { error } = await sb.auth.signOut();
    if (error) console.error('Logout error:', error);
  } finally {
    window.location.href = 'login.html';
  }
}

async function getCurrentProfile() {
  const { data: { user }, error: userError } = await sb.auth.getUser();

  if (userError || !user) return null;

  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Profile lookup error:', error);
    return null;
  }

  return data;
}

function showMessage(elementId, message, type = 'error') {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
