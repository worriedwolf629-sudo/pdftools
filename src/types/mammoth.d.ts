declare module 'mammoth' {
  export interface ConversionResult {
    value: string;
    messages: Array<{
      type: 'warning' | 'error';
      message: string;
    }>;
  }

  export interface MammothOptions {
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    convertImage?: any;
    [key: string]: any;
  }

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer } | { path: string },
    options?: MammothOptions
  ): Promise<ConversionResult>;

  export function extractRawText(
    input: { arrayBuffer: ArrayBuffer } | { path: string }
  ): Promise<{ value: string; messages: any[] }>;
}
