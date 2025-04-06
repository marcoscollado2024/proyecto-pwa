import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfId, searchText, options = {} } = await req.json();

    if (!searchText?.trim()) {
      throw new Error('Search text is required');
    }

    if (!pdfId) {
      throw new Error('PDF ID is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get the PDF by ID
    const { data: pdf, error: pdfError } = await supabase
      .from('pdfs')
      .select('extracted_text, name')
      .eq('id', pdfId)
      .single();

    if (pdfError) {
      console.error('Error fetching PDF:', pdfError);
      throw pdfError;
    }

    if (!pdf?.extracted_text) {
      return new Response(
        JSON.stringify({
          error: 'No text content available for this PDF',
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare search parameters
    const {
      caseSensitive = false,
      wholeWord = false,
      fuzzyMatch = true,
      contextLength = 100,
      maxResults = 50
    } = options;

    // Split text into pages
    const pages = pdf.extracted_text.split('[PAGE ');

    // Normalize search text based on options
    let normalizedSearch = searchText;
    if (!caseSensitive) {
      normalizedSearch = searchText.toLowerCase();
    }
    if (wholeWord) {
      normalizedSearch = `\\b${normalizedSearch}\\b`;
    }

    const results = [];
    let totalMatches = 0;

    // Process each page
    for (let i = 1; i < pages.length && totalMatches < maxResults; i++) {
      const pageContent = pages[i];
      const pageText = pageContent.split(']\n')[1];
      
      if (!pageText) continue;

      // Normalize page text based on options
      let normalizedText = pageText;
      if (!caseSensitive) {
        normalizedText = pageText.toLowerCase();
      }

      // Find matches
      const matches = findMatches(normalizedText, normalizedSearch, fuzzyMatch);

      for (const match of matches) {
        if (totalMatches >= maxResults) break;

        // Get surrounding context
        const contextStart = Math.max(0, match.index - contextLength);
        const contextEnd = Math.min(pageText.length, match.index + match.length + contextLength);

        // Extract and format context
        const beforeContext = pageText.slice(contextStart, match.index);
        const matchedText = pageText.slice(match.index, match.index + match.length);
        const afterContext = pageText.slice(match.index + match.length, contextEnd);

        results.push({
          pageNumber: i,
          text: {
            before: beforeContext,
            match: matchedText,
            after: afterContext
          },
          position: {
            start: match.index,
            end: match.index + match.length
          },
          score: match.score || 1
        });

        totalMatches++;
      }
    }

    // Sort results by relevance score
    results.sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({
        results,
        metadata: {
          documentName: pdf.name,
          totalResults: totalMatches,
          searchOptions: {
            caseSensitive,
            wholeWord,
            fuzzyMatch,
            contextLength,
            maxResults
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-pdf:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error searching PDF',
        results: []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

// Helper function to find matches with optional fuzzy matching
function findMatches(text: string, search: string, fuzzy = true): Array<{index: number; length: number; score?: number}> {
  const matches = [];
  
  if (fuzzy) {
    // Implement fuzzy matching using character-based similarity
    for (let i = 0; i < text.length; i++) {
      const potentialMatch = text.slice(i, i + search.length);
      const similarity = calculateSimilarity(potentialMatch, search);
      
      if (similarity > 0.8) { // Threshold for fuzzy matches
        matches.push({
          index: i,
          length: search.length,
          score: similarity
        });
      }
    }
  } else {
    // Standard exact matching
    let lastIndex = 0;
    let searchIndex;
    
    while ((searchIndex = text.indexOf(search, lastIndex)) !== -1) {
      matches.push({
        index: searchIndex,
        length: search.length,
        score: 1
      });
      lastIndex = searchIndex + 1;
    }
  }

  return matches;
}

// Helper function to calculate string similarity (Levenshtein distance based)
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  return 1 - (distance / maxLength);
}