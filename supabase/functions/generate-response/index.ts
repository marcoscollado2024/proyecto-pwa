import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    let body;
    try {
      body = await req.json();
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }

    const { prompt } = body;

    if (!prompt?.trim()) {
      return new Response(
        JSON.stringify({ content: 'Por favor, ingresa una pregunta.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Supabase's built-in AI to generate a response
    const { data: completion, error: completionError } = await supabase.rpc(
      'generate_completion',
      { prompt_text: prompt }
    );

    if (completionError) {
      throw completionError;
    }

    return new Response(
      JSON.stringify({ content: completion?.content || 'No se pudo generar una respuesta' }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('Error in generate-response:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        content: 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});