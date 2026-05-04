import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ypltblhhyqoesjvpbvkh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbHRibGhoeXFvZXNqdnBidmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4Mjg0ODgsImV4cCI6MjA5MzQwNDQ4OH0.XwL-lsmBaF16SyANvwQ6l9g5QGcDVH3VhmOTeBjgCps'

export const supabase = createClient(supabaseUrl, supabaseKey)