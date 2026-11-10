-- ==============================================================================
-- Migration: 20261110000004_revoke_anon_poraplan_resolver.sql
-- Description: Revoke anonymous execute on resolve_poraplan_id_login to prevent
--              public PoraPlan ID enumeration and account status discovery.
-- Phase: 2.3B.4.3 Authentication Abuse Protection & ID Enumeration Hardening
-- ==============================================================================

-- 1. Revoke public/anon execute on resolve_poraplan_id_login(TEXT)
REVOKE EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM anon;

-- 2. Restrict execution strictly to service_role (Edge Functions / internal server)
GRANT EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) TO service_role;

-- 3. Document the security model
COMMENT ON FUNCTION public.resolve_poraplan_id_login(TEXT) IS
'Privileged login resolver. Restricted to service_role to prevent unauthenticated client-side enumeration of PoraPlan IDs, synthetic auth emails, and account status.';
