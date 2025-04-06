import { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import * as PDFJS from 'pdfjs-dist';

// Configure PDF.js worker
const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
PDFJS.GlobalWorkerOptions.workerSrc = workerSrc;

// Constants for optimization
const MAX_THUMBNAIL_SIZE = 800;
const THUMBNAIL_QUALITY = 0.7;
const MAX_TEXT_CHUNK_SIZE = 1000000;
const MAX_OCR_ATTEMPTS = 2;

interface TextItem {
  str: string;
}

interface TextContent {
  items: TextItem[];
}

export async function generateThumbnail(pdfData: string): Promise<string> {
  try {
    if (!pdfData) {
      throw new Error('PDF data is empty or undefined');
    }

    const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const loadingTask = PDFJS.getDocument({
      data: bytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
    });

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(
      MAX_THUMBNAIL_SIZE / viewport.width,
      MAX_THUMBNAIL_SIZE / viewport.height
    );
    
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo obtener el contexto del canvas');
    }

    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
      background: 'white'
    }).promise;

    return canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY);
  } catch (error) {
    console.error('Error al generar la miniatura:', error);
    return '';
  }
}

export async function extractTextFromPDF(pdfData: string): Promise<string> {
  if (!pdfData) {
    throw new Error('El contenido del PDF está vacío o no es válido');
  }

  try {
    let base64Data: string;
    try {
      base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
      atob(base64Data);
    } catch (error) {
      throw new Error('El contenido del PDF no está en formato base64 válido');
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const loadingTask = PDFJS.getDocument({
      data: bytes,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
    });

    const pdf = await loadingTask.promise;
    let fullText = '';
    let textExtractionFailed = false;

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent() as TextContent;
        
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');

        if (!pageText.trim()) {
          textExtractionFailed = true;
          continue;
        }

        if (fullText.length + pageText.length > MAX_TEXT_CHUNK_SIZE) {
          fullText += pageText.substring(0, MAX_TEXT_CHUNK_SIZE - fullText.length);
          break;
        }

        fullText += pageText + '\n\n';
      } catch (error) {
        console.error(`Error al extraer texto de la página ${i}:`, error);
        textExtractionFailed = true;
      }
    }

    if (textExtractionFailed || !fullText.trim()) {
      let ocrText = '';
      let attempts = 0;

      while (attempts < MAX_OCR_ATTEMPTS && !ocrText.trim()) {
        try {
          const worker = await createWorker();
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) {
            throw new Error('No se pudo crear el contexto del canvas para OCR');
          }

          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport,
            background: 'white'
          }).promise;

          const { data: { text } } = await worker.recognize(canvas);
          await worker.terminate();
          
          ocrText = text.trim();
          attempts++;
        } catch (error) {
          console.error(`Intento ${attempts + 1} de OCR fallido:`, error);
          attempts++;
        }
      }

      if (ocrText) {
        fullText = ocrText;
      }
    }

    return fullText.trim() || 'No se pudo extraer texto del PDF';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar el PDF';
    console.error('Error al extraer texto del PDF:', errorMessage);
    throw new Error(`Error al procesar el PDF: ${errorMessage}`);
  }
}

export function preparePDFForViewing(content: string): string {
  try {
    if (!content) {
      throw new Error('El contenido del PDF está vacío');
    }

    if (content.startsWith('data:application/pdf;base64,')) {
      return content;
    }

    try {
      const base64Data = content.replace(/^data:.*?;base64,/, '');
      atob(base64Data);
      return `data:application/pdf;base64,${base64Data}`;
    } catch (error) {
      console.error('Error al validar base64:', error);
      throw new Error('El contenido del PDF no es un base64 válido');
    }
  } catch (error) {
    console.error('Error al preparar el PDF:', error);
    throw error;
  }
}