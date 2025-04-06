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

    const { query, documents } = await req.json();

    // Generar embeddings para la consulta
    const { data: queryEmbedding } = await supabase.functions.invoke('generate-embeddings', {
      body: { text: query }
    });

    // Procesar cada documento y encontrar similitudes
    const results = await Promise.all(
      documents.map(async (doc) => {
        const { data: docEmbedding } = await supabase.functions.invoke('generate-embeddings', {
          body: { text: doc.content }
        });

        // Calcular similitud coseno
        const similarity = calculateCosineSimilarity(queryEmbedding, docEmbedding);
        return {
          document: doc.name,
          similarity,
          content: doc.content
        };
      })
    );

    // Ordenar por similitud y tomar los más relevantes
    const relevantDocs = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    // Generar respuesta usando el modelo de IA
    const context = relevantDocs
      .map(doc => `Documento: ${doc.document}\n${doc.content}`)
      .join('\n\n');

    const { data: response } = await supabase.functions.invoke('generate-response', {
      body: {
        query,
        context
      }
    });

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  const dotProduct = vec1.reduce((acc, val, i) => acc + val * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((acc, val) => acc + val * val, 0));
  const norm2 = Math.sqrt(vec2.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (norm1 * norm2);
}