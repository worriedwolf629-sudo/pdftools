import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';

export interface PickOptions {
  accept?: string;
  multiple?: boolean;
}

/**
 * Converts a base64 string into a Blob.
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Universal file picker.
 * On Android/native: uses @capawesome/capacitor-file-picker.
 * On Web: uses standard <input type="file">.
 */
export async function pickFiles(options?: PickOptions): Promise<File[]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await FilePicker.pickFiles({
        readData: true,
        limit: options?.multiple ? 0 : 1
      });

      if (!result.files || result.files.length === 0) {
        return [];
      }

      const files: File[] = [];

      for (const pf of result.files) {
        let blob: Blob | null = null;

        // Try reading via webPath or native path if available
        if (pf.webPath || pf.path) {
          try {
            const url = pf.webPath || Capacitor.convertFileSrc(pf.path!);
            const response = await fetch(url);
            blob = await response.blob();
          } catch (e) {
            console.warn('Could not fetch picked file via path, falling back to data', e);
          }
        }

        // Fallback to base64 data if path read was unavailable
        if (!blob && pf.data) {
          try {
            blob = base64ToBlob(pf.data, pf.mimeType || 'application/octet-stream');
          } catch (e) {
            console.warn('Could not decode base64 data', e);
          }
        }

        // Fallback to blob property if present
        if (!blob && pf.blob) {
          blob = pf.blob;
        }

        if (blob) {
          const file = new File([blob], pf.name, {
            type: pf.mimeType || blob.type || 'application/octet-stream',
            lastModified: pf.modifiedAt || Date.now()
          });
          files.push(file);
        }
      }

      return files;
    } catch (err: any) {
      // User cancelled picker or dismissed dialog
      console.log('Native file picker cancelled or error:', err);
      return [];
    }
  }

  // Web platform: keep standard HTML <input type="file">
  return new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options?.accept) input.accept = options.accept;
    if (options?.multiple) input.multiple = true;
    input.style.display = 'none';

    let resolved = false;

    const cleanup = () => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    };

    input.onchange = () => {
      if (resolved) return;
      resolved = true;
      const files = Array.from(input.files || []);
      cleanup();
      resolve(files);
    };

    input.oncancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve([]);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Convenience helper to pick a single file.
 */
export async function pickSingleFile(options?: Omit<PickOptions, 'multiple'>): Promise<File | null> {
  const files = await pickFiles({ ...options, multiple: false });
  return files.length > 0 ? files[0] : null;
}

