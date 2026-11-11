// ==============================================================================
// Supabase Edge Function: resolve-poraplan-id
// Phase: 2.3B.4.5 Suspended Account RLS Enforcement, Resolver Privilege Fix & Edge Function Hardening
//
// Description:
// Resolves a PoraPlan ID to its internal authentication email on the server side.
// Hardened against ID enumeration and abuse:
// - SEC-01: Fails closed when Turnstile secret is missing or verification cannot be completed.
// - SEC-04: Enforces explicit frontend origin allowlist for CORS (no wildcard '*').
// - Returns uniform error responses to defeat account enumeration.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const BASE_ALLOWED_ORIGINS = [
  'https://poraplan.com',
  'https://www.poraplan.com',
];

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function getAllowedOrigins(): string[] {
  const allowed = new Set<string>(BASE_ALLOWED_ORIGINS);

  // Additional origins from environment (comma-separated)
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    for (const origin of envOrigins.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) {
        allowed.add(trimmed);
      }
    }
  }

  // Allow local development origins if not in production deployment or explicitly enabled
  const isDeployed = Boolean(Deno.env.get('DENO_DEPLOYMENT_ID'));
  const allowLocal = Deno.env.get('PORAPLAN_ALLOW_LOCAL_ORIGINS') === 'true' || !isDeployed;
  if (allowLocal) {
    for (const origin of LOCAL_DEV_ORIGINS) {
      allowed.add(origin);
    }
  }

  return Array.from(allowed);
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

interface ResolveRequestBody {
  poraplanId?: string;
  captchaToken?: string;
}

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  const origin = req.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.includes(origin)) {
      return new Response(
        JSON.stringify({ error: 'Origin not allowed by CORS.' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    let body: ResolveRequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request payload.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { poraplanId, captchaToken } = body;
    const cleanId = typeof poraplanId === 'string' ? poraplanId.trim().toUpperCase() : '';

    if (!cleanId) {
      return new Response(
        JSON.stringify({ error: 'Please enter your PoraPlan ID.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. SEC-01: Verify Turnstile (Fail-closed)
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    const isDeployed = Boolean(Deno.env.get('DENO_DEPLOYMENT_ID'));
    const allowLocalTurnstileBypass =
      Deno.env.get('PORAPLAN_ALLOW_LOCAL_TURNSTILE_BYPASS') === 'true' && !isDeployed;

    if (!turnstileSecret) {
      if (!allowLocalTurnstileBypass) {
        console.error('[resolve-poraplan-id] SEC-01: Missing TURNSTILE_SECRET_KEY in production/staging environment.');
        return new Response(
          JSON.stringify({ error: 'Authentication service configuration error.' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      // If allowLocalTurnstileBypass is explicitly true in local non-deployed env, proceed without verification
    } else {
      // Secret is present: require and verify captchaToken
      if (!captchaToken || typeof captchaToken !== 'string' || !captchaToken.trim()) {
        return new Response(
          JSON.stringify({ error: 'CAPTCHA verification required.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const clientIp = req.headers.get('cf-connecting-ip');
      const formData = new URLSearchParams();
      formData.append('secret', turnstileSecret);
      formData.append('response', captchaToken.trim());
      if (clientIp) {
        formData.append('remoteip', clientIp);
      }

      let siteverifyRes: Response;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        siteverifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch {
        console.error('[resolve-poraplan-id] SEC-01: Cloudflare Turnstile verification request failed or timed out.');
        return new Response(
          JSON.stringify({ error: 'CAPTCHA verification service temporarily unavailable.' }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!siteverifyRes.ok) {
        console.error('[resolve-poraplan-id] SEC-01: Cloudflare Turnstile responded with non-200 HTTP status.');
        return new Response(
          JSON.stringify({ error: 'CAPTCHA verification service temporarily unavailable.' }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      let siteverifyData: SiteverifyResponse;
      try {
        siteverifyData = await siteverifyRes.json();
      } catch {
        console.error('[resolve-poraplan-id] SEC-01: Cloudflare Turnstile response could not be parsed as JSON.');
        return new Response(
          JSON.stringify({ error: 'CAPTCHA verification service temporarily unavailable.' }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!siteverifyData.success) {
        return new Response(
          JSON.stringify({ error: 'CAPTCHA verification failed. Please try again.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 2. Privileged resolution using Supabase service role client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[resolve-poraplan-id] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
      return new Response(
        JSON.stringify({ error: 'Authentication service configuration error.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error: rpcError } = await supabaseAdmin.rpc('resolve_poraplan_id_login', {
      p_poraplan_id: cleanId,
    });

    if (rpcError) {
      console.error('[resolve-poraplan-id] Error executing resolve_poraplan_id_login RPC.');
      return new Response(
        JSON.stringify({ error: 'Authentication service temporarily unavailable.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Evaluate matching record
    if (data && data.length > 0) {
      const record = data[0];
      // If account is suspended, return uniform failure message so callers cannot distinguish
      if (record.account_status === 'suspended') {
        return new Response(
          JSON.stringify({ error: 'Invalid PoraPlan ID or password.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Valid and authenticatable account: return only authEmail
      return new Response(
        JSON.stringify({ authEmail: record.auth_email }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Record not found: return uniform failure message (anti-enumeration)
    return new Response(
      JSON.stringify({ error: 'Invalid PoraPlan ID or password.' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch {
    console.error('[resolve-poraplan-id] Unexpected error in handler.');
    return new Response(
      JSON.stringify({ error: 'Authentication service temporarily unavailable.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
