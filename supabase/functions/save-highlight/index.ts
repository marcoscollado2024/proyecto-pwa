import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Request-Headers': '*'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const { pdfId, pageNumber, text, color, position } = await req.json();

    if (!pdfId || !text || !position || typeof pageNumber !== 'number') {
      throw new Error('Missing required data');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify PDF exists
    const { data: pdf, error: pdfError } = await supabase
      .from('pdfs')
      .select('id')
      .eq('id', pdfId)
      .single();

    if (pdfError || !pdf) {
      throw new Error('PDF not found');
    }

    // Save highlight
    const { data: highlight, error } = await supabase
      .from('pdf_highlights')
      .insert({
        pdf_id: pdfId,
        page_number: pageNumber,
        text,
        color: color || '#ffeb3b',
        position
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ highlight }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in save-highlight:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 400
      }
    );
  }
});