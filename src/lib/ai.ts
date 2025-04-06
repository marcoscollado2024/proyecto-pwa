import type { Document } from '../types';

const MAX_DOCS_PER_BATCH = 10;
const MAX_CHARS_PER_DOC = 2000;
const MAX_TOTAL_CHARS = 15000;

export async function chatWithAI(message: string, selectedDocs: Document[] = []): Promise<string> {
  try {
    if (!message?.trim()) {
      throw new Error('Por favor, ingresa una pregunta.');
    }

    let prompt = `Eres un asistente virtual experto y servicial que:
1. Responde siempre en español de forma clara y natural
2. Proporciona respuestas detalladas y útiles
3. Mantiene un tono amigable y profesional
4. Si no tienes información suficiente, lo indicas claramente
5. Puedes analizar documentos cuando se proporcionan
6. Eres experto en procesar y explicar información académica\n`;

    if (selectedDocs.length > 0) {
      const processedDocs = [];
      let totalChars = 0;
      
      const sortedDocs = selectedDocs.sort((a, b) => {
        const aHasText = a.extracted_text?.trim() ? 1 : 0;
        const bHasText = b.extracted_text?.trim() ? 1 : 0;
        return bHasText - aHasText;
      });

      for (const doc of sortedDocs) {
        if (processedDocs.length >= MAX_DOCS_PER_BATCH) break;
        
        const text = doc.extracted_text?.trim() || doc.content?.trim();
        if (!text) continue;

        const docChars = Math.min(text.length, MAX_CHARS_PER_DOC);
        
        if (totalChars + docChars > MAX_TOTAL_CHARS) break;

        processedDocs.push({
          name: doc.name,
          content: text.slice(0, MAX_CHARS_PER_DOC)
        });

        totalChars += docChars;
      }

      if (processedDocs.length > 0) {
        prompt += `Basándote en estos ${processedDocs.length} documentos:\n${processedDocs.map((doc, index) => `[Documento ${index + 1}: ${doc.name}]\n${doc.content}`).join('\n\n')}\n\nProporciona una respuesta que:\n1. Sea específica al contenido de los documentos\n2. Cite información relevante cuando sea posible\n3. Indique si algo no está claro o necesita más contexto\n4. Mencione de qué documento proviene cada información citada\n`;

        if (processedDocs.length < selectedDocs.length) {
          prompt += `\nNota: Se han analizado ${processedDocs.length} de ${selectedDocs.length} documentos seleccionados para mantener la calidad del análisis.`;
        }
      } else {
        prompt += `NOTA: Los documentos seleccionados no contienen texto legible. Por favor:\n1. Indica al usuario que no se pudo extraer texto de los PDFs\n2. Sugiere que intente con otros documentos\n3. Ofrece ayuda general sobre el tema si es posible`;
      }
    }

    prompt += `\nPregunta del usuario: ${message}\n\nRespuesta:`;

    const response = await fetch('https://epmdkhktxjrdhrhdchzu.supabase.co/functions/v1/analyze-pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwbWRraGt0eGpyZGhyaGRjaHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NDE5NTksImV4cCI6MjA1OTUxNzk1OX0.E7SzmgiL5OrMT6wClXg0jJAKvkwRVScxzasoWkgFrx0`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        documents: selectedDocs
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errorData.error || 'Error al generar la respuesta');
    }

    const data = await response.json();
    return data.response || 'No se pudo generar una respuesta';
  } catch (error) {
    console.error('Error en chatWithAI:', error);
    throw error;
  }
}