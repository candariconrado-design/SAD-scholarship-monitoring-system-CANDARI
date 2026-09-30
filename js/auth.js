async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('message');

  if (!email || !password) {
    msg.innerHTML = '<div class="alert alert-error">Email and password required</div>';
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    msg.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
    return;
  }
  window.location.href = 'dashboard.html';
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}