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

    const { query, documents } = body;

    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ 
          response: 'Por favor, ingresa una pregunta.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let prompt = `Eres un asistente amigable y servicial. Responde de manera clara y concisa en español. `;
    
    if (documents?.length > 0) {
      const validDocs = documents
        .filter((doc: any) => doc.content?.trim() || doc.extracted_text?.trim())
        .slice(0, 3)
        .map((doc: any) => ({
          name: doc.name,
          content: (doc.extracted_text || doc.content || '').slice(0, 1500)
        }));

      if (validDocs.length > 0) {
        prompt += `Analiza estos documentos y responde la pregunta:

        Documentos:
        ${validDocs.map((doc: any) => `[${doc.name}] ${doc.content}`).join('\n\n')}
        `;
      }
    }

    prompt += `\nPregunta: ${query}\n\nRespuesta:`;

    // Call the completion function
    const { data: completion, error: completionError } = await supabase.rpc(
      'generate_completion',
      { prompt_text: prompt }
    );

    if (completionError) {
      throw completionError;
    }

    return new Response(
      JSON.stringify({ response: completion?.content || 'No se pudo generar una respuesta' }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('Error in search-pdfs:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        response: 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});