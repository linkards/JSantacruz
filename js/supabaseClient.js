/* ============================================================
   SUPABASE CLIENT
   Estos dos valores son PÚBLICOS por diseño: la URL del proyecto
   y la clave "anon" están hechas para vivir en el frontend.
   La seguridad real vive en las políticas RLS de la base de datos,
   no en mantener esto en secreto.

   NUNCA agregues aquí la "service_role key".
   ============================================================ */

const SUPABASE_URL = 'https://zccvxlodrcbrqheoqemg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjY3Z4bG9kcmNicnFoZW9xZW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTgyMTAsImV4cCI6MjEwMzM3NDIxMH0.2m5ArcoZ1Arcs80inB4JP2af6W7H0Kji6OfQFQLJHb4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
