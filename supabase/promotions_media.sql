-- Promotions image uploads (Storage)
-- Run in Supabase SQL editor.

begin;

-- Add image_path so we can delete storage objects reliably (publicUrl alone is not enough).
alter table if exists public.promotions
  add column if not exists image_path text;

commit;

-- Storage bucket creation must be done via Storage UI or SQL depending on Supabase version.
-- If your project supports SQL bucket creation, uncomment the block below.
--
-- insert into storage.buckets (id, name, public)
-- values ('promotions-media', 'promotions-media', true)
-- on conflict (id) do update set public = true;
--
-- Note: since uploads are done via server using SUPABASE_SERVICE_ROLE_KEY, storage policies are less critical for admin upload.
-- Public read is required if you want publicUrl images to render for everyone.

