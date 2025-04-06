import { HfInference } from 'npm:@huggingface/inference@2.6.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MAX_DOCS = 10;
const MAX_CHARS_PER_DOC = 2000;
const MAX_TOTAL_CHARS = 15000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, documents } = await req.json();
    
    if (!message?.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    const hf = new HfInference(Deno.env.get('HUGGINGFACE_API_KEY'));

    // Construir el prompt base
    let prompt = `Eres un asistente experto en análisis de documentos académicos que:
1. Analiza y comprende documentos en cualquier idioma
2. Proporciona respuestas detalladas y precisas en español
3. Mantiene el contexto y la coherencia en las respuestas
4. Cita información específica del texto cuando es relevante
5. Indica claramente cuando necesita más contexto
6. Se enfoca en el contenido sin hacer suposiciones

Instrucciones específicas:
- Analiza el contenido completo antes de responder
- Proporciona respuestas estructuradas y bien organizadas
- Cita ejemplos específicos del texto para respaldar tus respuestas
- Si el texto está en otro idioma, analízalo y responde en español
- Si no hay suficiente información, indícalo claramente
- Evita especulaciones o información no respaldada por el texto
`;

    if (documents?.length > 0) {
      // Process and sort documents by relevance
      const processedDocs = [];
      let totalChars = 0;

      const sortedDocs = documents
        .filter(doc => doc.content?.trim() || doc.extracted_text?.trim())
        .sort((a, b) => {
          const aHasText = a.extracted_text?.trim() ? 1 : 0;
          const bHasText = b.extracted_text?.trim() ? 1 : 0;
          return bHasText - aHasText;
        });

      for (const doc of sortedDocs) {
        if (processedDocs.length >= MAX_DOCS) break;

        const text = (doc.extracted_text || doc.content || '').trim();
        const docChars = Math.min(text.length, MAX_CHARS_PER_DOC);

        if (totalChars + docChars > MAX_TOTAL_CHARS) break;

        processedDocs.push({
          name: doc.name,
          content: text.slice(0, MAX_CHARS_PER_DOC)
        });

        totalChars += docChars;
      }

      if (processedDocs.length > 0) {
        prompt += `\nAnálisis basado en ${processedDocs.length} documentos:
${processedDocs.map((doc, i) => `[Documento ${i + 1}: ${doc.name}]\n${doc.content}`).join('\n\n')}

Instrucciones para el análisis:
1. Lee y comprende el contenido completo
2. Identifica los puntos principales y temas relevantes
3. Relaciona la información con la pregunta del usuario
4. Proporciona ejemplos específicos del texto
5. Mantén la coherencia y el contexto
6. Si el texto está en otro idioma:
   - Analiza el contenido en su idioma original
   - Proporciona la respuesta en español claro y natural
   - Mantén la precisión de la traducción
   - Cita el texto original cuando sea relevante

Nota: Indica de qué documento proviene cada información citada usando [Doc X].`;

        if (processedDocs.length < documents.length) {
          prompt += `\n\nNota: Se han analizado ${processedDocs.length} de ${documents.length} documentos para mantener la calidad del análisis.`;
        }
      }
    }

    prompt += `\nPregunta: ${message}\n\nRespuesta:`;

    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000, // Increased for more detailed responses
        temperature: 0.7,
        top_p: 0.95,
        repetition_penalty: 1.2,
        return_full_text: false
      }
    });

    const generatedText = response.generated_text?.trim();
    if (!generatedText) {
      throw new Error('No se pudo generar una respuesta válida');
    }

    return new Response(
      JSON.stringify({ response: generatedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en analyze-pdf:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        response: 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});