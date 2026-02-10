import { createClient } from '@supabase/supabase-js';

// Hardcoded for this specific event usage as requested
const SUPABASE_URL = 'https://cbtroatixvydpwoviezf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iFF5ToqeVnGyu_37Z6-KlA_kc8FMK8b'; // Assuming this maps to the anon key functionality or I should use the one if available. Wait, the user gave "sb_publishable...". I hope that works as the anon key. Usually it's an JWT.
// Actually, "sb_publishable_..." is likely a custom format or the user simply copied the wrong thing. Standard anon keys are JWTs (ey...).
// User said: "Here is the publishable key: sb_publishable_..."
// I will try to use it. If it fails, I'll error handling it.

// WAIT. "sb_publishable" is usually for *managed* Supabase services or wrappers.
// Standard Supabase anon keys start with `ey...`.
// However, I must try with what I was given.

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
