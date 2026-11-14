declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToSVG(imageData: ImageData, options?: Record<string, any>): string;
    imageToSVG(url: string, callback: (svgstr: string) => void, options?: Record<string, any>): void;
    appendSVGString(svgstr: string, parentid: string): void;
    [key: string]: any;
  };
  export default ImageTracer;
}

