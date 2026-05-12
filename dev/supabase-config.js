const SUPABASE_URL = 'https://wftycbttpwxzizqgwatu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmdHljYnR0cHd4eml6cWd3YXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzU4OTUsImV4cCI6MjA5MjExMTg5NX0.ifWKA5J4kGWXmznkA8grQHQera5IByTJX-3ssU_XK6g';

window.supabaseClient = null;

function initSupabase(callback) {
    console.log('🔄 Initializing Supabase...');
    
    // Если клиент уже создан — сразу вызываем callback
    if (window.supabaseClient) {
        console.log('✅ Supabase client already exists');
        if (callback) callback(window.supabaseClient);
        return;
    }
    
    function tryInit() {
        if (window.supabase) {
            console.log('✅ Supabase library loaded');
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    redirectTo: window.location.origin,
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false
                }
            });
            console.log('✅ Supabase client created');
            if (callback) callback(window.supabaseClient);
        } else {
            console.log('⏳ Waiting for Supabase library...');
            setTimeout(tryInit, 300);
        }
    }
    tryInit();
}

function getClient() {
    return window.supabaseClient;
}

function checkAuth() {
    const client = getClient();
    if (!client) return null;
    return client.auth.getUser();
}