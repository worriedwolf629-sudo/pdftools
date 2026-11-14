import React from 'react';
import { PdfViewer } from './PdfViewer';
import { ArchiveViewer } from './ArchiveViewer';
import { DocumentViewer } from './DocumentViewer';
import { ImageViewer } from './ImageViewer';
import { TextViewer } from './TextViewer';
import { PresentationViewer } from './PresentationViewer';
import { SpreadsheetViewer } from './SpreadsheetViewer';
import { EpubViewer } from './EpubViewer';
import { UnsupportedView } from './UnsupportedView';

export type ViewerRoute =
  | 'pdf'
  | 'text'
  | 'docx'
  | 'zip'
  | 'image'
  | 'pptx'
  | 'spreadsheet'
  | 'epub'
  | 'unsupported';

export const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv', 'tsv', 'ods']);
export const ARCHIVE_EXTENSIONS = new Set(['zip', 'cbz', 'cbr', 'tar', 'gz']);

export const CODE_TEXT_EXTENSIONS = new Set([
  'txt', 'text', 'log', 'env', 'ini', 'cfg', 'conf',
  'js', 'mjs', 'cjs', 'jsx',
  'ts', 'mts', 'cts', 'tsx',
  'java',
  'json',
  'html', 'htm',
  'css', 'scss', 'less',
  'py', 'pyw',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
  'rs',
  'go',
  'sh', 'bash', 'zsh',
  'sql',
  'yaml', 'yml',
  'xml',
  'md', 'markdown'
]);

export const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico', 'avif', 'tiff', 'tif'
]);

/**
 * Determine which viewer should open the file based on its extension.
 */
export function getRouteForExtension(fileName: string): { route: ViewerRoute; extension: string } {
  const parts = fileName.split('.');
  const extension = parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';

  if (extension === 'pdf') {
    return { route: 'pdf', extension };
  }

  if (extension === 'docx') {
    return { route: 'docx', extension };
  }

  if (extension === 'pptx') {
    return { route: 'pptx', extension };
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return { route: 'spreadsheet', extension };
  }

  if (extension === 'epub') {
    return { route: 'epub', extension };
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return { route: 'zip', extension };
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return { route: 'image', extension };
  }

  if (CODE_TEXT_EXTENSIONS.has(extension)) {
    return { route: 'text', extension };
  }

  return { route: 'unsupported', extension };
}

export interface FileRouterProps {
  file: File | Blob;
  fileName: string;
  onSelectAnotherFile?: (newFile: File) => void;
  onOpenWithTool?: (toolSlug: string, file: File) => void;
}

/**
 * Extension-based file router component.
 * Selects the viewer corresponding to the file extension, or renders UnsupportedView.
 */
export const FileRouter: React.FC<FileRouterProps> = ({
  file,
  fileName,
  onSelectAnotherFile,
  onOpenWithTool
}) => {
  const { route, extension } = getRouteForExtension(fileName);

  switch (route) {
    case 'pdf':
      return (
        <PdfViewer
          file={file}
          fileName={fileName}
          onOpenWithTool={onOpenWithTool}
        />
      );

    case 'docx':
      return (
        <DocumentViewer
          file={file}
          fileName={fileName}
        />
      );

    case 'pptx':
      return (
        <PresentationViewer
          file={file}
          fileName={fileName}
        />
      );

    case 'zip':
      return (
        <ArchiveViewer
          file={file}
          fileName={fileName}
          onPreviewSubFile={onSelectAnotherFile}
        />
      );

    case 'image':
      return (
        <ImageViewer
          file={file}
          fileName={fileName}
          onOpenWithTool={onOpenWithTool}
        />
      );

    case 'text':
      return (
        <TextViewer
          file={file}
          fileName={fileName}
          isMarkdown={extension === 'md' || extension === 'markdown'}
          isJson={extension === 'json'}
        />
      );

    case 'spreadsheet':
      return (
        <SpreadsheetViewer
          file={file}
          fileName={fileName}
        />
      );

    case 'epub':
      return (
        <EpubViewer
          file={file}
          fileName={fileName}
        />
      );

    case 'unsupported':
    default:
      return (
        <UnsupportedView
          file={file}
          fileName={fileName}
          extension={extension}
          onSelectAnotherFile={onSelectAnotherFile}
        />
      );
  }
};

