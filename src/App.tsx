import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Book, FileText, Loader2, Plus, Search, Send, Eye, Trash2 } from 'lucide-react';
import type { PDFLibrary } from './types';
import { getPDFs, deletePDF, savePDF } from './lib/supabase';
import { generateThumbnail, preparePDFForViewing } from './lib/pdfUtils';
import { chatWithAI } from './lib/ai';
import { PDFModal } from './components/PDFModal';
import { InstallPWA } from './components/InstallPWA';



function App() {
  const [biblioteca, setBiblioteca] = useState<PDFLibrary>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [selectedPDFs, setSelectedPDFs] = useState<Set<string>>(new Set());
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [currentPdf, setCurrentPdf] = useState<{ url: string; name: string } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMorePDFs, setHasMorePDFs] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPDFs();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const loadPDFs = async (page = 0) => {
    try {
      if (page === 0) {
        setIsLoading(true);
        setBiblioteca({});
      } else {
        setIsLoadingMore(true);
      }
      setErrorMessage('');

      const result = await getPDFs(page);
      
      if (result.error) {
        throw result.error;
      }

      setBiblioteca(prev => {
        const newBiblioteca = { ...prev };
        // Add type checking to ensure result.pdfs exists and is an array
        if (Array.isArray(result.pdfs)) {
          result.pdfs.forEach(pdf => {
            newBiblioteca[pdf.name] = {
              id: pdf.id,
              content: pdf.content,
              thumbnail: pdf.thumbnail || undefined,
              summary: pdf.summary || undefined,
              extracted_text: pdf.extracted_text || undefined
            };
          });
        }
        return newBiblioteca;
      });

      setHasMorePDFs(result.hasMore);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error al cargar PDFs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(`Error al cargar la biblioteca: ${errorMessage}. Por favor, intenta de nuevo.`);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMorePDFs = () => {
    if (!isLoadingMore && hasMorePDFs) {
      loadPDFs(currentPage + 1);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setErrorMessage('');

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target?.result;
        if (!base64Content || typeof base64Content !== 'string') {
          throw new Error('Error al leer el archivo PDF');
        }

        try {
          const thumbnail = await generateThumbnail(base64Content);

          const result = await savePDF({
            name: file.name,
            content: base64Content,
            thumbnail,
          });

          if (result.error) {
            throw result.error;
          }

          if (result.data) {
            setBiblioteca(prev => ({
              ...prev,
              [file.name]: {
                content: base64Content,
                thumbnail,
                id: result.data.id,
              }
            }));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido al procesar el PDF';
          throw new Error(`Error al procesar el PDF: ${errorMessage}`);
        }
      };

      reader.onerror = () => {
        throw new Error('Error al leer el archivo PDF');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(`Error al subir el PDF: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePDFSelection = useCallback((nombre: string) => {
    setSelectedPDFs(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(nombre)) {
        newSelection.delete(nombre);
      } else {
        newSelection.add(nombre);
      }
      return newSelection;
    });
  }, []);

  const handlePDFClick = useCallback(async (e: React.MouseEvent, nombre: string, content: string) => {
    e.stopPropagation();
    try {
      if (!content) {
        throw new Error('El contenido del PDF no está disponible');
      }
      const url = await preparePDFForViewing(content);
      setCurrentPdf({ url, name: nombre });
      setPdfModalOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(`Error al abrir el PDF: ${errorMessage}`);
    }
  }, []);

  const handleDeletePDF = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      await deletePDF(id);

      setBiblioteca(prev => {
        const newBiblioteca = { ...prev };
        Object.entries(newBiblioteca).forEach(([key, value]) => {
          if (value.id === id) {
            delete newBiblioteca[key];
          }
        });
        return newBiblioteca;
      });

      setSelectedPDFs(prev => {
        const newSelection = new Set(prev);
        Object.entries(biblioteca).forEach(([key, value]) => {
          if (value.id === id) {
            newSelection.delete(key);
          }
        });
        return newSelection;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(`Error al eliminar el PDF: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [biblioteca]);

  const handleChat = async () => {
    if (!chatInput.trim()) return;

    try {
      setIsChatLoading(true);
      setErrorMessage('');

      const selectedDocs = Array.from(selectedPDFs).map(name => ({
        name,
        content: biblioteca[name].content,
        extracted_text: biblioteca[name].extracted_text
      }));

      setChatHistory(prev => [...prev, { role: 'user', content: chatInput }]);

      const response = await chatWithAI(chatInput, selectedDocs);
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
      setChatInput('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(`Error al procesar la consulta: ${errorMessage}`);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Lo siento, hubo un error al procesar tu consulta. Por favor, intenta de nuevo.' 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSelectAllPDFs = useCallback(() => {
    setSelectedPDFs(prev => 
      prev.size === Object.keys(biblioteca).length 
        ? new Set() 
        : new Set(Object.keys(biblioteca))
    );
  }, [biblioteca]);

  const pdfList = useMemo(() => {
    return Object.entries(biblioteca).map(([nombre, doc]) => (
      <div 
        key={nombre}
        className={`bg-gray-800 border border-gray-700 rounded-lg overflow-hidden transition-all ${
          selectedPDFs.has(nombre) ? 'ring-2 ring-orange-500' : 'hover:border-orange-400'
        }`}
      >
        <div 
          className="aspect-[3/4] relative bg-gray-900 cursor-pointer"
          onClick={() => handlePDFSelection(nombre)}
        >
          {doc.thumbnail ? (
            <img 
              src={doc.thumbnail} 
              alt={`Miniatura de ${nombre}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
          )}
          {selectedPDFs.has(nombre) && (
            <div className="absolute inset-0 bg-orange-500 bg-opacity-20 flex items-center justify-center">
              <Search className="w-8 h-8 text-orange-400" />
            </div>
          )}
          <button
            onClick={(e) => handlePDFClick(e, nombre, doc.content)}
            className="absolute bottom-2 right-2 bg-gray-800 rounded-full p-2 shadow-lg hover:bg-gray-700 transition-colors"
            title="Abrir PDF"
          >
            <Eye className="w-4 h-4 text-orange-400" />
          </button>
        </div>
        <div className="p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="truncate text-sm font-medium text-gray-200 block">
                {nombre}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                doc.id && handleDeletePDF(doc.id);
              }}
              disabled={isLoading}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    ));
  }, [biblioteca, selectedPDFs, isLoading, handlePDFSelection, handlePDFClick, handleDeletePDF]);

  const documentOptions = useMemo(() => ({
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
  }), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Book className="w-6 h-6" />
              Biblioteca PDF Inteligente
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <div className="lg:col-span-1 space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={handleFileSelect}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Agregar PDF
                  </>
                )}
              </button>

              {errorMessage && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {errorMessage}
                  <button 
                    onClick={() => loadPDFs(0)}
                    className="ml-2 text-red-400 hover:text-red-300 underline hover:no-underline"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-200 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-400" />
                    Mis PDFs
                  </h2>
                  {Object.keys(biblioteca).length > 0 && (
                    <button
                      onClick={handleSelectAllPDFs}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm ${
                        selectedPDFs.size === Object.keys(biblioteca).length
                          ? 'bg-orange-600/20 text-orange-400'
                          : 'text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <Search className="w-4 h-4" />
                      {selectedPDFs.size === Object.keys(biblioteca).length
                        ? 'Deseleccionar todos'
                        : 'Seleccionar todos'}
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
                  {Object.entries(biblioteca).length > 0 ? (
                    <>
                      {pdfList}
                      {hasMorePDFs && (
                        <div className="col-span-full">
                          <button
                            onClick={loadMorePDFs}
                            disabled={isLoadingMore}
                            className="w-full py-2 px-4 bg-gray-700 text-orange-400 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isLoadingMore ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Cargando más PDFs...
                              </>
                            ) : (
                              'Cargar más PDFs'
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="col-span-full text-center py-8 bg-gray-900 rounded-lg">
                      <FileText className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400">
                        {isLoading ? 'Cargando PDFs...' : 'No hay PDFs en la biblioteca'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col bg-gray-800 rounded-lg border border-gray-700 shadow-sm">
              <div className="p-4 border-b border-gray-700 bg-gray-900">
                <h2 className="font-semibold text-gray-200">
                  Chat con la IA
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Puedes charlar con la IA o seleccionar PDFs para hacer preguntas sobre su contenido
                </p>
              </div>

              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{ maxHeight: 'calc(100vh - 400px)' }}
              >
                {chatHistory.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    <Book className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                    <p>¡Hola! Puedo ayudarte con cualquier pregunta. Si seleccionas PDFs, también puedo responder sobre su contenido.</p>
                  </div>
                )}
                {chatHistory.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-700 text-gray-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-700 rounded-lg px-4 py-2">
                      <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                    placeholder="Escribe tu pregunta..."
                    className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-200 placeholder-gray-500"
                    disabled={isChatLoading}
                  />
                  <button
                    onClick={handleChat}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isChatLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {currentPdf && (
        <PDFModal
          isOpen={pdfModalOpen}
          onClose={() => {
            setPdfModalOpen(false);
            setCurrentPdf(null);
          }}
          pdfUrl={currentPdf.url}
          fileName={currentPdf.name}
          options={documentOptions}
        />
      )}

      <InstallPWA />
    </div>
  );
}

export default App;
