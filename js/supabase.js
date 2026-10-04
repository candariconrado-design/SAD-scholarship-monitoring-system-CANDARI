const SUPABASE_URL = 'https://qxdmbtrjwwbpdedbdlhc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZG1idHJqd3dicGRlZGJkbGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MTM1OTYsImV4cCI6MjEwNjI4OTU5Nn0.39ZVye-vP7HoBGr_uTpl2YvufiG80doASzdfAzER6h4';

// Single global client to avoid redeclaration & multiple GoTrueClient issues
if (!window.sb) {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
