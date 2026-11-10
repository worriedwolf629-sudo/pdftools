import JSZip from 'jszip';
import { createExtractorFromData } from 'node-unrar-js';

export interface ArchiveEntry {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  formattedSize: string;
  date?: Date;
  extension: string;
  // Function to get the file blob on demand
  getBlob: () => Promise<Blob>;
}

export interface ArchiveData {
  archiveType: 'zip' | 'rar';
  fileName: string;
  totalFiles: number;
  totalSize: number;
  formattedTotalSize: string;
  entries: ArchiveEntry[];
}

export function formatArchiveBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || 'B'}`;
}

export async function parseZipArchive(fileOrBuffer: File | Blob | ArrayBuffer, fileName = 'archive.zip'): Promise<ArchiveData> {
  const buffer = fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;
  const zip = await JSZip.loadAsync(buffer);
  const entries: ArchiveEntry[] = [];
  let totalSize = 0;

  const paths = Object.keys(zip.files);
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const zipObj = zip.files[p];
    const isDir = zipObj.dir || p.endsWith('/');
    const name = p.split('/').filter(Boolean).pop() || p;
    const ext = isDir ? '' : (name.split('.').pop() || '').toLowerCase();
    
    // Uncompressed size is in _data.uncompressedSize if available
    const size = (zipObj as any)._data?.uncompressedSize || 0;
    if (!isDir) totalSize += size;

    entries.push({
      id: `zip-${i}-${p}`,
      name,
      path: p,
      isDir,
      size,
      formattedSize: isDir ? '--' : formatArchiveBytes(size),
      date: zipObj.date,
      extension: ext,
      getBlob: async () => {
        return await zipObj.async('blob');
      }
    });
  }

  // Sort directories first, then files alphabetically
  entries.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.path.localeCompare(b.path);
  });

  return {
    archiveType: 'zip',
    fileName,
    totalFiles: entries.filter((e) => !e.isDir).length,
    totalSize,
    formattedTotalSize: formatArchiveBytes(totalSize),
    entries
  };
}

let wasmCache: ArrayBuffer | null = null;

async function getUnrarWasmBinary(): Promise<ArrayBuffer> {
  if (wasmCache) return wasmCache;
  const response = await fetch('/unrar.wasm');
  if (!response.ok) {
    throw new Error(`Failed to load unrar.wasm (HTTP ${response.status})`);
  }
  wasmCache = await response.arrayBuffer();
  return wasmCache;
}

export async function parseRarArchive(
  fileOrBuffer: File | Blob | ArrayBuffer,
  fileName = 'archive.rar',
  password = ''
): Promise<ArchiveData> {
  const wasmBinary = await getUnrarWasmBinary();
  const buffer = fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;

  const extractor = await createExtractorFromData({
    wasmBinary,
    data: buffer,
    password
  });

  const extracted = extractor.extract();
  const fileList = [...extracted.files];

  const entries: ArchiveEntry[] = [];
  let totalSize = 0;

  for (let i = 0; i < fileList.length; i++) {
    const fileHeader = fileList[i];
    const isDir = fileHeader.fileHeader.flags.directory;
    const path = fileHeader.fileHeader.name;
    const name = path.split('/').filter(Boolean).pop() || path;
    const ext = isDir ? '' : (name.split('.').pop() || '').toLowerCase();
    const size = fileHeader.fileHeader.unpSize || 0;
    if (!isDir) totalSize += size;

    const fileExtractionData = fileHeader.extraction;

    entries.push({
      id: `rar-${i}-${path}`,
      name,
      path,
      isDir,
      size,
      formattedSize: isDir ? '--' : formatArchiveBytes(size),
      extension: ext,
      getBlob: async () => {
        if (!fileExtractionData) {
          throw new Error('File data not extracted (possibly password protected)');
        }
        const safeArray = new Uint8Array(fileExtractionData);
        return new Blob([safeArray]);
      }
    });
  }

  // Sort directories first, then alphabetical
  entries.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.path.localeCompare(b.path);
  });

  return {
    archiveType: 'rar',
    fileName,
    totalFiles: entries.filter((e) => !e.isDir).length,
    totalSize,
    formattedTotalSize: formatArchiveBytes(totalSize),
    entries
  };
}
