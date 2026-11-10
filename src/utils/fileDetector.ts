export type DetectedFileType =
  | 'pdf'
  | 'zip'
  | 'rar'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'image'
  | 'text'
  | 'markdown'
  | 'json'
  | 'video'
  | 'audio'
  | 'unknown';

export interface FileTypeMeta {
  type: DetectedFileType;
  extension: string;
  mime: string;
  label: string;
  iconName: string;
  canEditInPdfCraft?: boolean;
}

export function detectFileType(file: { name: string; type?: string }): FileTypeMeta {
  const name = file.name || 'unnamed';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  // 1. PDF
  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      type: 'pdf',
      extension: ext || 'pdf',
      mime: mime || 'application/pdf',
      label: 'PDF Document',
      iconName: 'FileText',
      canEditInPdfCraft: true
    };
  }

  // 2. RAR
  if (ext === 'rar' || mime.includes('rar')) {
    return {
      type: 'rar',
      extension: 'rar',
      mime: mime || 'application/x-rar-compressed',
      label: 'RAR Archive',
      iconName: 'Archive'
    };
  }

  // 3. ZIP and archive types
  if (ext === 'zip' || ext === '7z' || ext === 'tar' || ext === 'gz' || mime.includes('zip')) {
    return {
      type: 'zip',
      extension: ext || 'zip',
      mime: mime || 'application/zip',
      label: 'ZIP Archive',
      iconName: 'Archive'
    };
  }

  // 4. Word Docs (.docx, .doc, .odt, .rtf)
  if (ext === 'docx' || ext === 'doc' || ext === 'odt' || ext === 'rtf' || mime.includes('word') || mime.includes('officedocument.wordprocessingml')) {
    return {
      type: 'docx',
      extension: ext || 'docx',
      mime: mime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      label: ext === 'doc' ? 'Legacy Word Document (.doc)' : 'Word Document (.docx)',
      iconName: 'FileText'
    };
  }

  // 5. Excel Spreadsheets (.xlsx, .xls, .csv, .tsv, .ods)
  if (
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'csv' ||
    ext === 'tsv' ||
    ext === 'ods' ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv'
  ) {
    return {
      type: 'xlsx',
      extension: ext || 'xlsx',
      mime: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      label: ext === 'csv' ? 'CSV Table' : 'Excel Spreadsheet (.xlsx)',
      iconName: 'Table'
    };
  }

  // 6. PowerPoint Presentations (.pptx, .ppt)
  if (ext === 'pptx' || ext === 'ppt' || ext === 'odp' || mime.includes('presentation') || mime.includes('powerpoint')) {
    return {
      type: 'pptx',
      extension: ext || 'pptx',
      mime: mime || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      label: 'PowerPoint Presentation (.pptx)',
      iconName: 'Presentation'
    };
  }

  // 7. Images
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico', 'avif', 'tiff', 'tif'];
  if (imageExts.includes(ext) || mime.startsWith('image/')) {
    return {
      type: 'image',
      extension: ext || 'png',
      mime: mime || `image/${ext || 'png'}`,
      label: `${(ext || 'image').toUpperCase()} Image`,
      iconName: 'Image'
    };
  }

  // 8. Markdown
  if (ext === 'md' || ext === 'markdown') {
    return {
      type: 'markdown',
      extension: ext,
      mime: 'text/markdown',
      label: 'Markdown Document',
      iconName: 'FileCode'
    };
  }

  // 9. JSON
  if (ext === 'json') {
    return {
      type: 'json',
      extension: ext,
      mime: 'application/json',
      label: 'JSON Data',
      iconName: 'Braces'
    };
  }

  // 10. Audio
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
  if (audioExts.includes(ext) || mime.startsWith('audio/')) {
    return {
      type: 'audio',
      extension: ext || 'mp3',
      mime: mime || 'audio/mpeg',
      label: 'Audio File',
      iconName: 'Music'
    };
  }

  // 11. Video
  const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
  if (videoExts.includes(ext) || mime.startsWith('video/')) {
    return {
      type: 'video',
      extension: ext || 'mp4',
      mime: mime || 'video/mp4',
      label: 'Video File',
      iconName: 'Video'
    };
  }

  // 12. Plain Text / Code
  const codeExts = ['txt', 'log', 'env', 'ini', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'sh', 'sql', 'yaml', 'yml', 'xml'];
  if (codeExts.includes(ext) || mime.startsWith('text/')) {
    return {
      type: 'text',
      extension: ext || 'txt',
      mime: mime || 'text/plain',
      label: `${(ext || 'TXT').toUpperCase()} File`,
      iconName: 'FileCode'
    };
  }

  return {
    type: 'unknown',
    extension: ext || 'bin',
    mime: mime || 'application/octet-stream',
    label: `${(ext || 'Binary').toUpperCase()} File`,
    iconName: 'File'
  };
}

