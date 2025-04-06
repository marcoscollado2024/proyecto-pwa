import { useState, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Download, ZoomIn, ZoomOut, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PDFModalProps } from '../types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export function PDFModal({ isOpen, onClose, pdfUrl, fileName, options }: PDFModalProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const documentOptions = useMemo(() => ({
    cMapUrl: options?.cMapUrl || 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: options?.cMapPacked ?? true,
    standardFontDataUrl: options?.standardFontDataUrl || 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
  }), [options?.cMapUrl, options?.cMapPacked, options?.standardFontDataUrl]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error al cargar el PDF:', error);
    setError('No se pudo cargar el PDF. Intenta descargarlo.');
    setLoading(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-75 backdrop-blur-sm">
      <div className="fixed inset-4 z-50 overflow-hidden rounded-lg bg-gray-900 shadow-xl border border-gray-800 md:inset-6 lg:inset-8">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-gray-900">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-200 truncate max-w-md">
                {fileName}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 hover:bg-gray-800 rounded disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Página {currentPage} de {numPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                  disabled={currentPage >= numPages}
                  className="p-1 hover:bg-gray-800 rounded disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border-l border-gray-800 pl-2">
                <button
                  onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
                  className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200"
                  title="Reducir"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm w-12 text-center text-gray-400">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
                  className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200"
                  title="Ampliar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <a
                href={pdfUrl}
                download={fileName}
                className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200"
                title="Descargar PDF"
              >
                <Download className="w-5 h-5" />
              </a>

              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-900 p-4">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            )}

            {error && (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <p className="text-red-400">{error}</p>
                <a
                  href={pdfUrl}
                  download={fileName}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <Download className="w-5 h-5" />
                  Descargar PDF
                </a>
              </div>
            )}

            {!error && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                options={documentOptions}
              >
                <div className="flex flex-col items-center gap-4">
                  {Array.from(new Array(numPages), (_, index) => (
                    <div
                      key={`page_${index + 1}`}
                      className="bg-white shadow-lg"
                    >
                      <Page
                        pageNumber={index + 1}
                        scale={scale}
                        loading={
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                          </div>
                        }
                      />
                    </div>
                  ))}
                </div>
              </Document>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}