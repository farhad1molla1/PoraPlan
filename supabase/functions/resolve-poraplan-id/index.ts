// ==============================================================================
// Supabase Edge Function: resolve-poraplan-id
// Phase: 2.3B.4.3 Authentication Abuse Protection & ID Enumeration Hardening
//
// Description:
// Resolves a PoraPlan ID to its internal authentication email on the server side.
// Enforces Cloudflare Turnstile verification before database resolution to defeat
// automated enumeration. Returns uniform error responses so callers cannot
// distinguish between invalid IDs and suspended accounts.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
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

    // 1. Verify Turnstile if secret key is configured in the environment
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (turnstileSecret) {
      if (!captchaToken || typeof captchaToken !== 'string') {
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
      formData.append('response', captchaToken);
      if (clientIp) {
        formData.append('remoteip', clientIp);
      }

      const siteverifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!siteverifyRes.ok) {
        return new Response(
          JSON.stringify({ error: 'CAPTCHA verification service temporarily unavailable.' }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const siteverifyData: SiteverifyResponse = await siteverifyRes.json();
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
      // Do not disclose internal database details
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
    // Top-level catch: never leak stack traces
    return new Response(
      JSON.stringify({ error: 'Authentication service temporarily unavailable.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
