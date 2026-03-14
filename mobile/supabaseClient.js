import { createClient } from '@supabase/supabase-js';

// Replace these with the real values from your Supabase API settings
const supabaseUrl = 'https://qplfuioxdcuwhjsaeqip.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbGZ1aW94ZGN1d2hqc2FlcWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDUyMDksImV4cCI6MjA4OTA4MTIwOX0.wtzEZWIbfybmq8cS_vY3WBg0B3C6GkZ6qj2GqjTFhlE';

export const supabase = createClient(supabaseUrl, supabaseKey);