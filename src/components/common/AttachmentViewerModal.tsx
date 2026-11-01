import React, { useEffect } from 'react';
import {
  X,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';

export interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string | null;
  fileSize?: number | null;
  loading?: boolean;
  error?: string | null;
  onDownload?: () => void;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  fileSize,
  loading = false,
  error = null,
  onDownload,
}) => {
  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Determine file extension and viewer category
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isDocx = ext === 'docx';

  const formatSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formattedSize = formatSize(fileSize);

  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-brand-dark/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl bg-brand-paper border-4 border-brand-dark shadow-brutal-lg flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b-3 border-brand-dark bg-brand-bg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isImage ? (
              <ImageIcon className="w-5 h-5 text-brand-teal flex-shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-brand-navy flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h2
                id="attachment-modal-title"
                className="font-heading font-black text-sm sm:text-base text-brand-navy truncate"
                title={fileName}
              >
                {fileName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={isPdf ? 'navy' : isImage ? 'teal' : 'gold'} size="sm">
                  {ext.toUpperCase() || 'FILE'}
                </Badge>
                {formattedSize && (
                  <span className="font-mono text-[11px] text-brand-muted">
                    {formattedSize}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 border-2 border-brand-dark bg-white hover:bg-brand-paper shadow-brutal-xs text-brand-dark transition-all"
              aria-label="Close Attachment Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-teal" />
              <p className="font-mono text-xs font-bold text-brand-muted uppercase tracking-wider">
                Generating secure access link...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border-3 border-red-500 text-red-800 space-y-2 shadow-brutal-sm">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span>Unable to Display Attachment</span>
              </div>
              <p className="text-xs font-mono">{error}</p>
            </div>
          ) : !fileUrl ? (
            <div className="py-16 text-center text-brand-muted font-mono text-xs">
              No preview URL available for this file.
            </div>
          ) : isImage ? (
            <div className="bg-brand-bg border-3 border-brand-dark p-4 flex items-center justify-center shadow-brutal-sm overflow-hidden">
              <img
                src={fileUrl}
                alt={fileName}
                className="max-h-[65vh] max-w-full object-contain mx-auto"
              />
            </div>
          ) : isPdf ? (
            <div className="border-3 border-brand-dark bg-white shadow-brutal-sm overflow-hidden h-[68vh]">
              <iframe
                src={fileUrl}
                title={fileName}
                className="w-full h-full border-0"
              />
            </div>
          ) : isDocx ? (
            <div className="p-8 text-center bg-brand-paper border-3 border-brand-dark shadow-brutal-sm space-y-4 max-w-lg mx-auto">
              <div className="w-14 h-14 bg-brand-bg border-3 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
                <FileText className="w-7 h-7 text-brand-navy" />
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-brand-navy mb-1">
                  Microsoft Word Document (.docx)
                </h3>
                <p className="text-xs text-brand-muted leading-relaxed">
                  Browser security rules and file formatting prevent inline viewing of .docx documents. Please download the attachment to view the complete solution file.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadClick}
                className="flex items-center gap-2 mx-auto"
              >
                <Download className="w-4 h-4" />
                Download Document
              </Button>
            </div>
          ) : (
            <div className="p-8 text-center bg-brand-paper border-3 border-brand-dark shadow-brutal-sm space-y-4 max-w-lg mx-auto">
              <FileText className="w-10 h-10 text-brand-muted mx-auto" />
              <p className="text-xs text-brand-muted">
                Inline preview is not supported for this file type. You can download the file to inspect its contents.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadClick}
                className="flex items-center gap-2 mx-auto"
              >
                <Download className="w-4 h-4" />
                Download Attachment
              </Button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-3 border-brand-dark bg-brand-bg flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-mono text-brand-muted">
            {fileUrl && !fileUrl.startsWith('blob:') && (
              <span className="flex items-center gap-1 text-brand-teal font-bold">
                <ExternalLink className="w-3.5 h-3.5" />
                Authorized Private Storage Link
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>

            {fileUrl && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleDownloadClick}
                className="flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download File
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

