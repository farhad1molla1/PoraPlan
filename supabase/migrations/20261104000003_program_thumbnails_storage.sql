-- ==============================================================================
-- PoraPlan: Program Thumbnails Storage Provisioning
--
-- 1. Storage Bucket Provisioning:
--    - Public bucket 'program-thumbnails' with 5MB file size limit
--    - Allowed MIME types: image/png, image/jpeg, image/webp
--
-- 2. Storage Row-Level Security Policies:
--    - Public SELECT access for viewing program thumbnails
--    - Authenticated Administrator-only INSERT, UPDATE, DELETE access
-- ==============================================================================

-- 1. Ensure the program-thumbnails bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'program-thumbnails',
  'program-thumbnails',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- 2. Public Read Access
DROP POLICY IF EXISTS "Public can view program thumbnails" ON storage.objects;
CREATE POLICY "Public can view program thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'program-thumbnails');

-- 3. Admin-Only Upload Access
DROP POLICY IF EXISTS "Admins can upload program thumbnails" ON storage.objects;
CREATE POLICY "Admins can upload program thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'program-thumbnails'
  AND (SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin'
);

-- 4. Admin-Only Update Access
DROP POLICY IF EXISTS "Admins can update program thumbnails" ON storage.objects;
CREATE POLICY "Admins can update program thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'program-thumbnails'
  AND (SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin'
)
WITH CHECK (
  bucket_id = 'program-thumbnails'
  AND (SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin'
);

-- 5. Admin-Only Delete Access
DROP POLICY IF EXISTS "Admins can delete program thumbnails" ON storage.objects;
CREATE POLICY "Admins can delete program thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'program-thumbnails'
  AND (SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin'
);

