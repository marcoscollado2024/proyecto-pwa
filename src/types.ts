export interface PDFLibrary {
  [key: string]: PDFDocument;
}

export interface PDFDocument {
  id: string;
  content: string;
  thumbnail?: string;
  summary?: string;
  extracted_text?: string;
}

export interface User {
  id: string;
  email: string;
}

export interface PDFTextContent {
  items: Array<{ str: string }>;
}

export interface PDFPageProxy {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getTextContent: (options?: { normalizeWhitespace?: boolean; disableCombineTextItems?: boolean }) => Promise<PDFTextContent>;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    background?: string;
    intent?: string;
  }) => { promise: Promise<void> };
}

export interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  fileName: string;
  options?: {
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
  };
}

export interface Document {
  name: string;
  content: string;
  extracted_text?: string;
}

export interface ChatResponse {
  response: string;
  error?: string;
}