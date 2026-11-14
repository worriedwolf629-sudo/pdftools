export interface ToolSEO {
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  howToSteps: { step: string; text: string }[];
  features: { title: string; desc: string }[];
  faqs: { question: string; answer: string }[];
}

export interface PDFTool {
  id: string;
  name: string;
  slug: string;
  category: string;
  categoryName: string;
  description: string;
  shortDescription: string;
  iconName: string;
  keywords: string[];
  popular?: boolean;
  seo: ToolSEO;
  relatedToolIds: string[];
}

export interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  iconName: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'file-opener', name: 'File Opener & Viewer', description: 'Instantly view and inspect PDF, ZIP, RAR, Word, Excel, PowerPoint, Images', iconName: 'FolderOpen' },
  { id: 'merge-split', name: 'Merge & Split', description: 'Combine multiple PDFs or divide pages into separate files', iconName: 'Layers' },
  { id: 'compress-pdf', name: 'Compress PDF', description: 'Reduce PDF file size without sacrificing document quality', iconName: 'Minimize2' },
  { id: 'convert-pdf', name: 'Convert PDF', description: 'Convert PDFs to Images, Text, HTML, or images to PDF', iconName: 'RefreshCw' },
  { id: 'edit-pdf', name: 'Edit PDF', description: 'Add text, drawings, shapes, whiteouts, and annotations', iconName: 'FileEdit' },
  { id: 'organize', name: 'Organize Pages', description: 'Reorder, rotate, delete, or extract specific PDF pages', iconName: 'Grid' },
  { id: 'security', name: 'Security & Password', description: 'Password protect, encrypt, or unlock protected PDF files', iconName: 'ShieldCheck' },
  { id: 'forms-signatures', name: 'Sign PDF', description: 'Draw, type, or upload custom digital signatures onto PDFs', iconName: 'PenTool' },
  { id: 'ocr', name: 'OCR Text Recognition', description: 'Extract text from scanned PDFs and images using browser OCR', iconName: 'ScanText' },
  { id: 'watermark-numbers', name: 'Watermark & Numbers', description: 'Stamp custom text watermarks or add dynamic page numbering', iconName: 'Hash' },
  { id: 'metadata-info', name: 'Metadata & Info', description: 'View, edit metadata tags, or audit PDF document details', iconName: 'FileSearch' },
];

export const TOOLS: PDFTool[] = [
  {
    id: 'open-file',
    name: 'Universal File Opener',
    slug: 'open-file',
    category: 'file-opener',
    categoryName: 'File Opener & Viewer',
    description: 'Instantly view, inspect, and open any PDF, ZIP, RAR, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), Images, and Code in your browser with 100% privacy.',
    shortDescription: 'Open & view PDF, Office, ZIP, or compress & resize/enlarge images and PDFs',
    iconName: 'FolderOpen',
    keywords: [
      'open file', 'file opener', 'file viewer', 'open zip', 'open rar', 'view docx',
      'view excel', 'view pptx', 'open pdf', 'view pdf', 'image viewer',
      'compress image', 'image compressor', 'shrink image', 'compress photo', 'reduce image size',
      'resize image', 'enlarge image', 'image resizer', 'upscale image', 'image scale', 'enlarge photo',
      'resize pdf', 'enlarge pdf', 'scale pdf', 'pdf scaler', 'enlarge', 'resize'
    ],
    popular: true,
    relatedToolIds: ['merge-pdf', 'compress-pdf', 'edit-pdf', 'sign-pdf'],
    seo: {
      title: 'Universal File Opener – Open PDF, ZIP, RAR, Word, Excel & PPTX Online',
      metaDescription: 'Free online file opener and viewer. Open PDF, ZIP, RAR, DOCX, XLSX, PPTX, Images and Code files instantly in your browser with zero upload.',
      h1: 'Instant Universal File Opener & Viewer',
      intro: 'Open and inspect any popular file format directly in your browser. From PDFs and compressed archives to Word documents, Excel spreadsheets, PowerPoint presentations, and high-resolution images — all processed locally in memory with 100% confidentiality.',
      howToSteps: [
        { step: '1. Select or Drop File', text: 'Drag and drop any file (PDF, ZIP, RAR, DOCX, XLSX, PPTX, Image) or click to browse.' },
        { step: '2. Instant In-Browser Render', text: 'The document or archive opens in milliseconds with no upload waiting time.' },
        { step: '3. Inspect & Interact', text: 'Browse pages, extract archive contents, filter spreadsheet rows, present slides, or zoom images.' },
        { step: '4. Export or Edit', text: 'Send directly to PDFCraft editing tools, download extracted files, or print.' }
      ],
      features: [
        { title: 'Zero Server Uploads', desc: '100% private. Files are processed entirely inside your device browser memory.' },
        { title: 'Wide Format Support', desc: 'Opens PDF, ZIP, RAR, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), images, audio, video, and code.' },
        { title: 'PWA & OS Integration', desc: 'Set as default viewer on mobile or desktop to open files directly from WhatsApp or file managers.' }
      ],
      faqs: [
        { question: 'Can this open files directly from WhatsApp or mobile downloads?', answer: 'Yes! Install PDFCraft as a Web App (PWA) or use your browser Share menu to open files directly into PDFCraft instantly.' },
        { question: 'Are my confidential documents uploaded to any server?', answer: 'Never. All parsing and rendering (PDF.js, JSZip, WebAssembly Unrar, SheetJS, docx-preview) runs 100% locally in your browser.' }
      ]
    }
  },
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    slug: 'merge-pdf',
    category: 'merge-split',
    categoryName: 'Merge & Split',
    description: 'Combine multiple PDF documents into a single organized PDF file seamlessly in your browser.',
    shortDescription: 'Combine multiple PDF files into one single PDF',
    iconName: 'Combine',
    keywords: ['merge pdf', 'combine pdf', 'join pdf files', 'concatenate pdf', 'append pdf'],
    popular: true,
    relatedToolIds: ['split-pdf', 'compress-pdf', 'rotate-pdf'],
    seo: {
      title: 'Merge PDF Online – Free & Secure PDF Combiner',
      metaDescription: 'Combine multiple PDF files into one consolidated PDF file online. Fast, browser-based, 100% free and private.',
      h1: 'Merge PDF Files Online',
      intro: 'Combine two or more PDF files into a single structured document. Drag and drop your files, reorder them as needed, and instantly merge them with full client-side privacy.',
      howToSteps: [
        { step: '1. Upload Files', text: 'Drag and drop your PDF documents into the file dropzone or click to select files from your computer.' },
        { step: '2. Reorder Files', text: 'Arrange your uploaded PDFs in the exact sequence you want them to appear in the merged output.' },
        { step: '3. Click Merge PDF', text: 'Hit the "Merge PDF" button to process your files in seconds locally within your web browser.' },
        { step: '4. Download Merged File', text: 'Download your unified PDF file immediately to your computer or mobile device.' }
      ],
      features: [
        { title: '100% Private Browser Processing', desc: 'Your files are processed directly inside your browser. No files are ever uploaded to external servers.' },
        { title: 'Drag & Drop Page Reordering', desc: 'Easily rearrange files and pages using intuitive thumbnail drag-and-drop controls.' },
        { title: 'Unlimited File Combinations', desc: 'Merge as many PDF documents as you need without file quantity limitations.' }
      ],
      faqs: [
        { question: 'Is it safe to merge confidential PDFs here?', answer: 'Yes, absolutely. PDFCraft uses WebAssembly and client-side JavaScript (pdf-lib) to merge files directly in your web browser memory. Your files never touch our servers.' },
        { question: 'Can I reorder pages before merging?', answer: 'Yes, our visual thumbnail organizer allows you to reorder, rotate, or remove pages before downloading the final merged PDF.' }
      ]
    }
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    slug: 'split-pdf',
    category: 'merge-split',
    categoryName: 'Merge & Split',
    description: 'Divide a large PDF file into separate pages or custom page ranges with zero quality loss.',
    shortDescription: 'Split a PDF into separate files by page range or individual pages',
    iconName: 'Split',
    keywords: ['split pdf', 'separate pdf pages', 'extract pdf pages', 'divide pdf', 'cut pdf'],
    popular: true,
    relatedToolIds: ['merge-pdf', 'extract-pages', 'delete-pdf-pages', 'compress-pdf'],
    seo: {
      title: 'Split PDF Online – Separate PDF Pages Easily',
      metaDescription: 'Split PDF files into individual pages or specific page ranges. Free online tool with client-side privacy.',
      h1: 'Split PDF Documents Online',
      intro: 'Extract specific pages or break a multi-page PDF document into separate smaller PDF files effortlessly. Download as individual files or a single ZIP archive.',
      howToSteps: [
        { step: '1. Select PDF File', text: 'Choose the PDF document you want to split from your local device.' },
        { step: '2. Choose Split Mode', text: 'Select custom page ranges (e.g. 1-3, 5, 8-10) or split every N pages into individual files.' },
        { step: '3. Process Split', text: 'Click "Split PDF" to instantly divide the pages in your browser.' },
        { step: '4. Download Output', text: 'Download the split PDF files or a packaged ZIP file containing all generated documents.' }
      ],
      features: [
        { title: 'Flexible Range Selection', desc: 'Split by custom page ranges, extract single pages, or split into equal page chunks.' },
        { title: 'Instant ZIP Package', desc: 'Download all split PDF pages in a single convenient ZIP file.' }
      ],
      faqs: [
        { question: 'Can I extract only even or odd pages?', answer: 'Yes, you can input specific page range rules such as "1,3,5" or "2,4,6" to extract only selected pages.' }
      ]
    }
  },
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    slug: 'compress-pdf',
    category: 'compress-pdf',
    categoryName: 'Compress PDF',
    description: 'Reduce PDF file size for email sharing and web storage while maintaining maximum visual quality.',
    shortDescription: 'Reduce PDF file size with adjustable compression levels',
    iconName: 'Minimize2',
    keywords: [
      'compress pdf', 'reduce pdf size', 'shrink pdf', 'optimize pdf', 'smaller pdf',
      'compress image', 'resize pdf', 'enlarge pdf', 'scale pdf', 'pdf resizer', 'pdf scaler', 'change pdf size', 'enlarge', 'resize', 'scale'
    ],
    popular: true,
    relatedToolIds: ['merge-pdf', 'pdf-to-jpg', 'pdf-info'],
    seo: {
      title: 'Compress PDF Online – Reduce PDF File Size Free',
      metaDescription: 'Shrink PDF file size online with customizable Low, Medium, and High compression settings. Fast and private.',
      h1: 'Compress PDF File Size Online',
      intro: 'Optimize your PDF documents to fit email attachment limits or speed up website load times. Choose from recommended preset compression levels or custom image optimization settings.',
      howToSteps: [
        { step: '1. Upload PDF', text: 'Select the large PDF file you wish to compress.' },
        { step: '2. Select Quality Preset', text: 'Choose between Low (Extreme Compression), Medium (Recommended), or High Quality (Low Compression).' },
        { step: '3. Click Compress PDF', text: 'Processing starts immediately inside your browser, calculating exact file savings.' },
        { step: '4. Save Compressed File', text: 'Download your reduced PDF file and view the percentage reduction achieved.' }
      ],
      features: [
        { title: 'Preset & Custom Quality Levels', desc: 'Easily balance document clarity against file size targets.' },
        { title: 'File Savings Counter', desc: 'See exact MB/KB reduction stats and percentage saved before downloading.' }
      ],
      faqs: [
        { question: 'Will compressing my PDF damage text clarity?', answer: 'No, text content remains crisp vector data. Compression primarily re-encodes embedded raster images and strips unneeded stream overhead.' }
      ]
    }
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    slug: 'pdf-to-jpg',
    category: 'convert-pdf',
    categoryName: 'Convert PDF',
    description: 'Convert PDF pages into high-resolution JPG images in seconds.',
    shortDescription: 'Convert every page of a PDF into JPG images',
    iconName: 'Image',
    keywords: ['pdf to jpg', 'pdf to image', 'convert pdf to jpeg', 'export pdf pages as jpg'],
    popular: true,
    relatedToolIds: ['jpg-to-pdf', 'extract-images'],
    seo: {
      title: 'PDF to JPG Converter Online – High Resolution Export',
      metaDescription: 'Convert PDF document pages to JPG images in high resolution. Extract all pages or specific pages to JPG.',
      h1: 'Convert PDF to JPG Images',
      intro: 'Transform your multi-page PDF documents into sharp, standalone JPG graphics. Download individual images or a ZIP archive containing all pages.',
      howToSteps: [
        { step: '1. Select PDF File', text: 'Upload your PDF document to the converter workstation.' },
        { step: '2. Adjust Quality Settings', text: 'Select desired image resolution (150 DPI, 300 DPI high quality).' },
        { step: '3. Convert Pages', text: 'Click "Convert to JPG" to render pages directly to browser canvas.' },
        { step: '4. Download JPGs', text: 'Save individual image files or grab the full ZIP archive.' }
      ],
      features: [
        { title: 'Crystal Clear Rendering', desc: 'Uses Mozilla PDF.js rendering engine for sharp vector-to-raster conversion.' },
        { title: 'Batch Page Export', desc: 'Extract 100+ pages into JPG format seamlessly.' }
      ],
      faqs: [
        { question: 'Is my document text readable in the output JPG?', answer: 'Yes, at 300 DPI rendering quality, text and fine lines remain crisp and readable.' }
      ]
    }
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    slug: 'jpg-to-pdf',
    category: 'convert-pdf',
    categoryName: 'Convert PDF',
    description: 'Convert JPG, PNG, or WebP images into a single clean PDF document with custom margins.',
    shortDescription: 'Combine images (JPG, PNG, WebP) into a clean PDF document',
    iconName: 'FilePlus',
    keywords: ['jpg to pdf', 'image to pdf', 'png to pdf', 'convert photos to pdf', 'photos to pdf'],
    popular: true,
    relatedToolIds: ['pdf-to-jpg', 'merge-pdf', 'compress-pdf'],
    seo: {
      title: 'JPG to PDF Converter – Convert Images to PDF Online',
      metaDescription: 'Convert JPG, PNG, and WebP photos into a single PDF file online. Customize page orientation, layout, and margins.',
      h1: 'Convert JPG Images to PDF',
      intro: 'Turn your digital photos, scanned receipts, or graphics into a clean PDF document. Reorder images, set page margins, and download your consolidated PDF.',
      howToSteps: [
        { step: '1. Select Images', text: 'Upload one or multiple JPG, PNG, or WebP image files.' },
        { step: '2. Arrange Order & Layout', text: 'Drag images to reorder them and pick page orientation (Portrait or Landscape).' },
        { step: '3. Generate PDF', text: 'Click "Convert to PDF" to compile your image portfolio.' },
        { step: '4. Save PDF File', text: 'Download your freshly created PDF file.' }
      ],
      features: [
        { title: 'Multi-Image Batch Upload', desc: 'Combine dozens of images in one click.' },
        { title: 'Custom Page Layouts', desc: 'Auto-fit images to full page, A4 size, or Letter format.' }
      ],
      faqs: [
        { question: 'Can I mix PNG and JPG files in the same PDF?', answer: 'Yes! You can select mixed image formats (JPG, PNG, WebP, GIF) simultaneously.' }
      ]
    }
  },
  {
    id: 'edit-pdf',
    name: 'Edit PDF',
    slug: 'edit-pdf',
    category: 'edit-pdf',
    categoryName: 'Edit PDF',
    description: 'Add text, freehand drawings, highlights, shapes, sticky notes, and whiteout to PDF documents.',
    shortDescription: 'Add text, shapes, drawings, and annotations directly to your PDF',
    iconName: 'FileEdit',
    keywords: ['edit pdf', 'annotate pdf', 'add text to pdf', 'draw on pdf', 'whiteout pdf'],
    popular: true,
    relatedToolIds: ['sign-pdf', 'watermark-pdf', 'rotate-pdf'],
    seo: {
      title: 'Free PDF Editor Online – Annotate & Edit PDF Files',
      metaDescription: 'Edit PDF files in your browser. Add text boxes, freehand annotations, highlight text, draw shapes, and white out content.',
      h1: 'Edit PDF Documents Online',
      intro: 'Modify your PDF files with rich annotation tools. Insert custom text, sketch freehand notes, highlight key sentences, draw geometrical shapes, or whiteout unwanted text.',
      howToSteps: [
        { step: '1. Load PDF Document', text: 'Upload the PDF file you want to edit.' },
        { step: '2. Use Annotation Tools', text: 'Choose from Text Box, Pen Draw, Highlight, Rectangle, Arrow, or Whiteout tools.' },
        { step: '3. Position Elements', text: 'Drag, resize, or style elements with custom colors and font sizes.' },
        { step: '4. Save & Download', text: 'Click "Export Edited PDF" to render all overlay annotations onto your final PDF.' }
      ],
      features: [
        { title: 'Full Canvas Editor', desc: 'Interactive browser canvas for precision element positioning.' },
        { title: 'Undo & Redo Support', desc: 'Easily step back through your edit history.' }
      ],
      faqs: [
        { question: 'Can I remove existing PDF text?', answer: 'You can use the Whiteout / Eraser tool to cover existing content, and overlay new custom text on top.' }
      ]
    }
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    slug: 'rotate-pdf',
    category: 'organize',
    categoryName: 'Organize Pages',
    description: 'Rotate upside-down or sideways PDF pages by 90°, 180°, or 270° degrees.',
    shortDescription: 'Rotate individual pages or all pages of a PDF document',
    iconName: 'RotateCw',
    keywords: ['rotate pdf', 'turn pdf pages', 'landscape to portrait pdf', 'flip pdf'],
    popular: false,
    relatedToolIds: ['merge-pdf', 'delete-pdf-pages'],
    seo: {
      title: 'Rotate PDF Pages Online – Permanent PDF Rotation',
      metaDescription: 'Rotate PDF pages clockwise or counter-clockwise. Permanently fix upside-down or landscape pages.',
      h1: 'Rotate PDF Pages Online',
      intro: 'Fix orientation issues in scanned documents or presentations. Rotate specific pages or apply 90° / 180° rotation to every page in your document.',
      howToSteps: [
        { step: '1. Upload PDF', text: 'Select the PDF file requiring orientation adjustments.' },
        { step: '2. Rotate Pages', text: 'Click individual page thumbnail rotate buttons or use global rotation controls.' },
        { step: '3. Save Rotated PDF', text: 'Click "Apply Rotation" to rewrite page rotation matrices.' },
        { step: '4. Download Result', text: 'Save your perfectly aligned PDF document.' }
      ],
      features: [
        { title: 'Visual Thumbnail Rotation', desc: 'Preview changes live on each thumbnail before saving.' }
      ],
      faqs: [
        { question: 'Is the rotation permanent when opened in Adobe Reader?', answer: 'Yes! PDFCraft writes permanent transformation matrices into the PDF file structure.' }
      ]
    }
  },
  {
    id: 'delete-pdf-pages',
    name: 'Delete PDF Pages',
    slug: 'delete-pdf-pages',
    category: 'organize',
    categoryName: 'Organize Pages',
    description: 'Remove unnecessary or blank pages from your PDF file in one click.',
    shortDescription: 'Select and remove unwanted pages from any PDF document',
    iconName: 'Trash2',
    keywords: ['delete pdf pages', 'remove pages from pdf', 'cut pages out of pdf'],
    popular: false,
    relatedToolIds: ['extract-pages', 'split-pdf', 'rotate-pdf'],
    seo: {
      title: 'Delete PDF Pages Online – Remove Unwanted Pages',
      metaDescription: 'Select and remove unwanted pages from your PDF file online. Quick visual preview and page deletion.',
      h1: 'Delete Unwanted PDF Pages',
      intro: 'Clean up bloated or error-filled PDF files by deleting excess pages. Select thumbnails visually or enter page numbers to delete.',
      howToSteps: [
        { step: '1. Upload PDF', text: 'Select the PDF file containing pages you wish to remove.' },
        { step: '2. Click Pages to Delete', text: 'Click on page thumbnails to mark them for deletion.' },
        { step: '3. Confirm Deletion', text: 'Click "Remove Selected Pages" to purge marked pages.' },
        { step: '4. Download Clean PDF', text: 'Save your streamlined document.' }
      ],
      features: [
        { title: 'Visual Selection Grid', desc: 'Interactive grid view makes identifying unwanted pages effortless.' }
      ],
      faqs: [
        { question: 'What happens if I delete all pages?', answer: 'At least one page must remain to generate a valid PDF document.' }
      ]
    }
  },
  {
    id: 'extract-pages',
    name: 'Extract PDF Pages',
    slug: 'extract-pdf-pages',
    category: 'organize',
    categoryName: 'Organize Pages',
    description: 'Pick and export specific pages from a PDF file into a new dedicated document.',
    shortDescription: 'Save selected PDF pages as a new standalone document',
    iconName: 'FolderOutput',
    keywords: ['extract pdf pages', 'export pages from pdf', 'save selected pdf pages'],
    popular: false,
    relatedToolIds: ['split-pdf', 'delete-pdf-pages', 'merge-pdf'],
    seo: {
      title: 'Extract PDF Pages Online – Export Custom Pages',
      metaDescription: 'Select specific pages from a PDF file and save them into a new standalone PDF document.',
      h1: 'Extract Pages From PDF Document',
      intro: 'Isolate key pages from lengthy reports or eBooks. Select exact page numbers to construct a new targeted PDF document instantly.',
      howToSteps: [
        { step: '1. Upload File', text: 'Open your multi-page PDF document.' },
        { step: '2. Select Extraction Pages', text: 'Click thumbnails or enter numbers like "1, 4, 7-10".' },
        { step: '3. Extract', text: 'Click "Extract Pages" to build the isolated PDF.' },
        { step: '4. Save PDF', text: 'Download your new custom PDF.' }
      ],
      features: [
        { title: 'Targeted Page Assembly', desc: 'Combine non-consecutive pages into a single new document.' }
      ],
      faqs: [
        { question: 'Does page extraction alter my original file?', answer: 'No, your original file remains untouched on your device.' }
      ]
    }
  },
  {
    id: 'sign-pdf',
    name: 'Sign PDF',
    slug: 'sign-pdf',
    category: 'forms-signatures',
    categoryName: 'Sign PDF',
    description: 'Draw, type, or upload custom digital signatures to sign contracts and documents online.',
    shortDescription: 'Add your electronic signature to any PDF document safely',
    iconName: 'PenTool',
    keywords: ['sign pdf', 'electronic signature', 'fill and sign pdf', 'signature on pdf'],
    popular: true,
    relatedToolIds: ['edit-pdf', 'protect-pdf', 'watermark-pdf'],
    seo: {
      title: 'Sign PDF Online – Free Electronic Signature Tool',
      metaDescription: 'Create and place your electronic signature on PDF documents. Draw, type, or upload your signature graphic.',
      h1: 'Sign PDF Documents Online',
      intro: 'Sign non-disclosure agreements, contracts, and application forms online without printing. Create your signature with a mouse, touch screen, typed font, or image file.',
      howToSteps: [
        { step: '1. Load PDF Contract', text: 'Upload the document requiring your signature.' },
        { step: '2. Create Signature', text: 'Draw your signature on screen, type your name, or upload a signature PNG image.' },
        { step: '3. Place on Document', text: 'Drag, resize, and position your signature signature block on the designated signature line.' },
        { step: '4. Download Signed PDF', text: 'Export your signed PDF document securely.' }
      ],
      features: [
        { title: '3 Signature Creation Modes', desc: 'Draw freehand, type with calligraphic fonts, or upload a transparent signature image.' },
        { title: 'Date & Initial Stamps', desc: 'Include dynamic date fields and initial stamps alongside signatures.' }
      ],
      faqs: [
        { question: 'Is my signature saved on a server?', answer: 'No! All signature rendering happens strictly inside your local browser.' }
      ]
    }
  },
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    slug: 'protect-pdf',
    category: 'security',
    categoryName: 'Security & Password',
    description: 'Encrypt your PDF document with a strong password to restrict unauthorized opening.',
    shortDescription: 'Encrypt your PDF document with strong password protection',
    iconName: 'Lock',
    keywords: ['protect pdf', 'encrypt pdf', 'password protect pdf', 'secure pdf'],
    popular: true,
    relatedToolIds: ['unlock-pdf', 'sign-pdf', 'watermark-pdf'],
    seo: {
      title: 'Password Protect PDF Online – Encrypt PDF Files',
      metaDescription: 'Secure your confidential PDF files with strong password encryption. Prevent unauthorized viewing.',
      h1: 'Password Protect PDF Documents',
      intro: 'Shield sensitive financial statements, legal records, and personal documents from unwanted access by locking them with custom password encryption.',
      howToSteps: [
        { step: '1. Upload PDF', text: 'Select the file you want to password protect.' },
        { step: '2. Enter Password', text: 'Type a secure password and confirm it.' },
        { step: '3. Encrypt Document', text: 'Click "Encrypt & Secure PDF" to apply password locks.' },
        { step: '4. Save Protected PDF', text: 'Download your newly encrypted PDF document.' }
      ],
      features: [
        { title: 'AES Standard Encryption', desc: 'Standard compliant PDF password locking compatible with Adobe Acrobat.' }
      ],
      faqs: [
        { question: 'What happens if I forget the password I set?', answer: 'Because encryption happens locally on your device, we do not store your password. Keep a record of your chosen password.' }
      ]
    }
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    slug: 'unlock-pdf',
    category: 'security',
    categoryName: 'Security & Password',
    description: 'Remove password protection from encrypted PDF files when you have authorization.',
    shortDescription: 'Remove password protection from your PDF document',
    iconName: 'Unlock',
    keywords: ['unlock pdf', 'remove pdf password', 'decrypt pdf', 'unprotect pdf'],
    popular: true,
    relatedToolIds: ['protect-pdf', 'compress-pdf', 'edit-pdf'],
    seo: {
      title: 'Unlock PDF Online – Remove Password Protection',
      metaDescription: 'Remove password restrictions from PDF files quickly. Access and edit password-protected documents.',
      h1: 'Remove Password Protection From PDF',
      intro: 'Remove password prompts from owner-authorized PDF files so you can view, edit, and print your documents freely without re-typing passwords.',
      howToSteps: [
        { step: '1. Select Encrypted PDF', text: 'Choose the password-protected PDF document.' },
        { step: '2. Provide Password', text: 'Enter the valid password for authorization.' },
        { step: '3. Remove Encryption', text: 'Click "Unlock PDF" to strip password security layers.' },
        { step: '4. Download Unlocked PDF', text: 'Save your unrestricted PDF document.' }
      ],
      features: [
        { title: 'Instant Password Removal', desc: 'Quickly strip security layers once authorized.' }
      ],
      faqs: [
        { question: 'Can I unlock a PDF without knowing the password?', answer: 'No. To ensure legal compliance, you must provide the correct authorization password to decrypt the file.' }
      ]
    }
  },
  {
    id: 'watermark-pdf',
    name: 'Watermark PDF',
    slug: 'watermark-pdf',
    category: 'watermark-numbers',
    categoryName: 'Watermark & Numbers',
    description: 'Add custom text or image watermarks to all pages of your PDF document.',
    shortDescription: 'Stamp custom text or logo watermarks onto PDF pages',
    iconName: 'Stamp',
    keywords: ['watermark pdf', 'add watermark to pdf', 'stamp pdf', 'confidential watermark'],
    popular: false,
    relatedToolIds: ['add-page-numbers', 'edit-pdf', 'protect-pdf'],
    seo: {
      title: 'Add Watermark to PDF Online – Custom Text Stamp',
      metaDescription: 'Add text watermarks like "CONFIDENTIAL" or "DRAFT" to PDF pages. Adjust position, opacity, font size, and color.',
      h1: 'Add Custom Watermarks to PDF',
      intro: 'Protect your intellectual property or label document status by stamping custom text watermarks across your PDF pages with full style controls.',
      howToSteps: [
        { step: '1. Select PDF File', text: 'Upload the document requiring watermarking.' },
        { step: '2. Configure Watermark', text: 'Enter custom text (e.g. "CONFIDENTIAL", "SAMPLE") and adjust angle, opacity, size, and color.' },
        { step: '3. Apply Watermark', text: 'Click "Apply Watermark" to overlay graphics on every page.' },
        { step: '4. Download PDF', text: 'Save your watermarked document.' }
      ],
      features: [
        { title: 'Custom Opacity & Rotation', desc: 'Set diagonal or horizontal angles with adjustable transparency.' }
      ],
      faqs: [
        { question: 'Can I watermark only specific pages?', answer: 'Yes, you can choose to apply watermarks to all pages or custom page subsets.' }
      ]
    }
  },
  {
    id: 'add-page-numbers',
    name: 'Add Page Numbers',
    slug: 'add-page-numbers',
    category: 'watermark-numbers',
    categoryName: 'Watermark & Numbers',
    description: 'Insert clear page numbers (e.g. "Page X of Y") into headers or footers of your PDF.',
    shortDescription: 'Insert dynamic page numbering into PDF headers or footers',
    iconName: 'Hash',
    keywords: ['add page numbers to pdf', 'number pdf pages', 'pdf page numbering', 'bates numbering'],
    popular: false,
    relatedToolIds: ['watermark-pdf', 'merge-pdf', 'pdf-metadata'],
    seo: {
      title: 'Add Page Numbers to PDF Online – Custom Footers',
      metaDescription: 'Insert page numbers into PDF header or footer margins. Customize starting number, alignment, and formatting.',
      h1: 'Number PDF Pages Online',
      intro: 'Organize formal reports, dissertations, and legal packets by adding clean page numbering in top or bottom margins with custom formatting.',
      howToSteps: [
        { step: '1. Upload PDF Document', text: 'Choose the document you want to number.' },
        { step: '2. Select Position & Style', text: 'Pick Top/Bottom, Left/Center/Right alignment, and number format (e.g., "Page {n} of {total}").' },
        { step: '3. Apply Numbering', text: 'Click "Insert Page Numbers" to stamp headers/footers.' },
        { step: '4. Download Numbered PDF', text: 'Save your formatted document.' }
      ],
      features: [
        { title: 'Flexible Position Matrix', desc: 'Place numbers in top-left, top-center, top-right, bottom-left, bottom-center, or bottom-right.' }
      ],
      faqs: [
        { question: 'Can I start numbering from page 2?', answer: 'Yes, you can set the starting page offset and start index.' }
      ]
    }
  },
  {
    id: 'ocr-pdf',
    name: 'OCR PDF Recognition',
    slug: 'ocr-pdf',
    category: 'ocr',
    categoryName: 'OCR Text Recognition',
    description: 'Extract text from scanned PDFs or photos using artificial intelligence OCR inside your browser.',
    shortDescription: 'Extract text from scanned PDF documents and images with OCR',
    iconName: 'ScanText',
    keywords: ['ocr pdf', 'extract text from scan', 'image ocr', 'scanned pdf to text', 'tesseract ocr'],
    popular: true,
    relatedToolIds: ['pdf-to-text', 'edit-pdf', 'pdf-to-jpg'],
    seo: {
      title: 'Free OCR PDF Tool Online – Recognize Scanned Text',
      metaDescription: 'Convert scanned PDF pages and images into editable, copyable text online using client-side Tesseract.js OCR engine.',
      h1: 'Recognize Text in Scanned PDFs (OCR)',
      intro: 'Turn unsearchable scanned paper documents or photographed pages into clear, copyable text data. Powered by browser-native optical character recognition.',
      howToSteps: [
        { step: '1. Upload Scanned PDF or Image', text: 'Select your scanned PDF or photo file.' },
        { step: '2. Choose Language', text: 'Select recognition language (English, Spanish, French, German, etc.).' },
        { step: '3. Run OCR Processing', text: 'Click "Start OCR Recognition" to parse characters locally.' },
        { step: '4. Copy or Export Text', text: 'Copy recognized text to clipboard or download as TXT / PDF.' }
      ],
      features: [
        { title: 'Client-Side Neural OCR', desc: 'Runs Tesseract.js WebAssembly engine directly in browser memory.' },
        { title: 'Multi-Language Support', desc: 'Accurately recognizes English, Spanish, French, German, and 100+ languages.' }
      ],
      faqs: [
        { question: 'Does OCR upload my sensitive scans to any cloud server?', answer: 'No! The OCR model executes entirely inside your web browser via WebAssembly.' }
      ]
    }
  },
  {
    id: 'pdf-to-text',
    name: 'PDF to Text',
    slug: 'pdf-to-text',
    category: 'convert-pdf',
    categoryName: 'Convert PDF',
    description: 'Extract all textual content from a PDF file into a plain text (TXT) file.',
    shortDescription: 'Extract plain text content from any searchable PDF file',
    iconName: 'FileText',
    keywords: ['pdf to text', 'extract text from pdf', 'pdf to txt', 'copy pdf text'],
    popular: false,
    relatedToolIds: ['ocr-pdf', 'pdf-to-jpg'],
    seo: {
      title: 'PDF to Text Converter – Extract PDF Text Online',
      metaDescription: 'Extract text from PDF documents quickly. Download as TXT file or copy directly to clipboard.',
      h1: 'Extract Text From PDF Files',
      intro: 'Pull out textual data from PDF reports, eBooks, and articles without manual copy-pasting. Download structured TXT output instantly.',
      howToSteps: [
        { step: '1. Select PDF', text: 'Upload your PDF document.' },
        { step: '2. Extract Content', text: 'Click "Extract Text" to parse text streams.' },
        { step: '3. Preview & Copy', text: 'View extracted text on screen and copy or download TXT file.' }
      ],
      features: [
        { title: 'Instant Extraction', desc: 'Parses thousands of words per second.' }
      ],
      faqs: [
        { question: 'Why is no text extracted from my scanned file?', answer: 'If your PDF is an image scan, use our OCR PDF tool to perform Optical Character Recognition.' }
      ]
    }
  },
  {
    id: 'pdf-metadata',
    name: 'PDF Metadata Editor',
    slug: 'pdf-metadata',
    category: 'metadata-info',
    categoryName: 'Metadata & Info',
    description: 'View, edit, or wipe document metadata tags (Title, Author, Subject, Keywords, Creator).',
    shortDescription: 'View, edit, or wipe PDF document metadata fields',
    iconName: 'Tag',
    keywords: ['pdf metadata', 'edit pdf title', 'pdf author tag', 'remove pdf metadata', 'clean pdf tags'],
    popular: false,
    relatedToolIds: ['pdf-info', 'protect-pdf', 'watermark-pdf'],
    seo: {
      title: 'PDF Metadata Editor – Change PDF Title & Author Tags',
      metaDescription: 'Inspect and edit PDF metadata properties including Title, Author, Subject, Keywords, and Producer.',
      h1: 'Edit or Clear PDF Metadata',
      intro: 'Maintain proper document cataloging or scrub hidden author tags before publishing documents online.',
      howToSteps: [
        { step: '1. Load PDF Document', text: 'Upload your PDF to view current metadata fields.' },
        { step: '2. Modify Fields', text: 'Update Title, Author, Subject, Keywords, or click "Wipe All Metadata".' },
        { step: '3. Save Changes', text: 'Click "Update Metadata" to rewrite PDF header information.' }
      ],
      features: [
        { title: 'Privacy Metadata Scrubber', desc: 'Remove sensitive creation dates and hidden creator software tags in one click.' }
      ],
      faqs: [
        { question: 'Why is editing metadata useful?', answer: 'Correct metadata ensures accurate preview snippets in web search engines and document management systems.' }
      ]
    }
  },
  {
    id: 'pdf-info',
    name: 'PDF Information & Audit',
    slug: 'pdf-info',
    category: 'metadata-info',
    categoryName: 'Metadata & Info',
    description: 'Inspect detailed structural properties, page dimensions, PDF version, encryption status, and fonts.',
    shortDescription: 'Audit structural properties, page counts, dimensions, and version of any PDF',
    iconName: 'FileSearch',
    keywords: ['pdf info', 'inspect pdf', 'pdf details', 'pdf dimensions', 'pdf analyzer'],
    popular: false,
    relatedToolIds: ['pdf-metadata', 'compress-pdf', 'compare-pdf'],
    seo: {
      title: 'PDF File Inspector – Detailed Document Audit',
      metaDescription: 'Analyze PDF files online. View page count, file size, dimensions in inches/mm, PDF specification version, and security status.',
      h1: 'Audit PDF File Properties & Details',
      intro: 'Gain complete visibility into your PDF document structure. Discover precise page dimensions, color specs, security settings, and embedded assets.',
      howToSteps: [
        { step: '1. Select PDF File', text: 'Drop your PDF into the inspection container.' },
        { step: '2. View Detailed Report', text: 'Instantly view page counts, byte size, dimensions, and version specs.' }
      ],
      features: [
        { title: 'Comprehensive Diagnostic Matrix', desc: 'Displays millimeter and inch page sizes, encryption flags, and page bounds.' }
      ],
      faqs: [
        { question: 'Can I audit large files?', answer: 'Yes, because parsing is local, files process instantly without network delays.' }
      ]
    }
  },
  {
    id: 'compare-pdf',
    name: 'Compare PDF Files',
    slug: 'compare-pdf',
    category: 'metadata-info',
    categoryName: 'Metadata & Info',
    description: 'Compare two PDF files side-by-side to highlight text and page length differences.',
    shortDescription: 'Compare two PDF documents side-by-side to find differences',
    iconName: 'GitCompare',
    keywords: ['compare pdf', 'pdf diff', 'side by side pdf comparison', 'check pdf changes'],
    popular: false,
    relatedToolIds: ['pdf-info', 'edit-pdf', 'pdf-to-text'],
    seo: {
      title: 'Compare PDF Files Online – Side-by-Side Diff Checker',
      metaDescription: 'Compare two PDF documents side-by-side. Spot text modifications, page insertions, and structural differences.',
      h1: 'Compare PDF Documents Side-by-Side',
      intro: 'Verify revisions in contracts, drafts, or technical specs. Compare two PDF versions side-by-side with clear visual highlight diffs.',
      howToSteps: [
        { step: '1. Upload Both PDFs', text: 'Select Document A (Original) and Document B (Modified).' },
        { step: '2. Run Comparison', text: 'Click "Compare PDFs" to parse page structures and text streams.' },
        { step: '3. Review Diffs', text: 'Inspect highlighted text additions, deletions, and page count changes.' }
      ],
      features: [
        { title: 'Side-by-Side Visual Split', desc: 'Dual-pane comparison layout for fast review.' }
      ],
      faqs: [
        { question: 'Does it highlight text changes?', answer: 'Yes! Text diff algorithms compare extracted words line-by-line.' }
      ]
    }
  },
  {
    id: 'extract-images',
    name: 'Extract Images from PDF',
    slug: 'extract-images-from-pdf',
    category: 'convert-pdf',
    categoryName: 'Convert PDF',
    description: 'Extract embedded photos, graphics, and figures from a PDF document as standalone image files.',
    shortDescription: 'Extract graphics and photos embedded inside a PDF document',
    iconName: 'ImagePlus',
    keywords: ['extract images from pdf', 'save pdf pictures', 'pdf image extractor', 'rip images from pdf'],
    popular: false,
    relatedToolIds: ['pdf-to-jpg', 'jpg-to-pdf', 'pdf-to-text'],
    seo: {
      title: 'Extract Images From PDF Online – Download ZIP',
      metaDescription: 'Rip embedded images and graphics from any PDF file. Download individual photos or a combined ZIP archive.',
      h1: 'Extract Embedded Pictures From PDF',
      intro: 'Extract photos, diagrams, and artwork embedded within PDF publications. Save extracted images in original quality as a ZIP package.',
      howToSteps: [
        { step: '1. Upload PDF File', text: 'Choose the PDF containing embedded photos.' },
        { step: '2. Extract Graphics', text: 'Click "Extract All Images" to extract graphic elements.' },
        { step: '3. Save Image ZIP', text: 'Download extracted photos individually or as a complete ZIP.' }
      ],
      features: [
        { title: 'Preserves Original Quality', desc: 'Pulls raw embedded image streams without degradation.' }
      ],
      faqs: [
        { question: 'What image formats are extracted?', answer: 'Extracted images are rendered and packaged as high-quality PNG/JPG files.' }
      ]
    }
  },
  {
    id: 'text-to-pdf',
    name: 'Text to PDF',
    slug: 'text-to-pdf',
    category: 'create-pdf',
    categoryName: 'Create PDF',
    description: 'Convert raw plain text or notes into a clean, formatted PDF document.',
    shortDescription: 'Convert plain text notes or articles into a PDF document',
    iconName: 'FileText',
    keywords: ['text to pdf', 'txt to pdf', 'convert raw text to pdf', 'create pdf from text'],
    popular: false,
    relatedToolIds: ['markdown-to-pdf', 'jpg-to-pdf', 'pdf-to-text'],
    seo: {
      title: 'Text to PDF Converter – Create PDF from Plain Text',
      metaDescription: 'Convert plain text notes or code into a downloadable PDF document with custom font size and page margins.',
      h1: 'Convert Text Notes to PDF',
      intro: 'Paste or type plain text, articles, or code snippets into our web editor and generate a clean PDF document instantly.',
      howToSteps: [
        { step: '1. Enter Text', text: 'Paste or type your text content into the text workstation.' },
        { step: '2. Customize Font & Size', text: 'Set line spacing, font size, and page margins.' },
        { step: '3. Export PDF', text: 'Click "Generate PDF" to download your document.' }
      ],
      features: [
        { title: 'Instant Typography Styling', desc: 'Renders clean typography with automatic pagination.' }
      ],
      faqs: [
        { question: 'Does it auto-wrap long text lines?', answer: 'Yes, text automatically wraps to fit standard page dimensions with balanced margins.' }
      ]
    }
  },
  {
    id: 'markdown-to-pdf',
    name: 'Markdown to PDF',
    slug: 'markdown-to-pdf',
    category: 'create-pdf',
    categoryName: 'Create PDF',
    description: 'Convert Markdown formatted text (# Headers, **Bold**, Lists, Code) into a styled PDF document.',
    shortDescription: 'Convert Markdown formatted text into a styled PDF document',
    iconName: 'Code',
    keywords: ['markdown to pdf', 'md to pdf', 'convert markdown to pdf', 'styled pdf generator'],
    popular: false,
    relatedToolIds: ['text-to-pdf', 'jpg-to-pdf', 'pdf-to-text'],
    seo: {
      title: 'Markdown to PDF Converter – Convert MD to PDF Online',
      metaDescription: 'Convert Markdown documents (# H1, code blocks, lists, quotes) into beautifully styled PDF files.',
      h1: 'Convert Markdown Files to Styled PDF',
      intro: 'Transform developer documentation, notes, and README files written in Markdown into sleek, print-ready PDF publications.',
      howToSteps: [
        { step: '1. Paste Markdown', text: 'Input your Markdown syntax into the live editor.' },
        { step: '2. Live Preview', text: 'Review rendered headings, bold text, bullet points, and code formatting.' },
        { step: '3. Save PDF', text: 'Click "Export PDF" to download your rendered document.' }
      ],
      features: [
        { title: 'Full Markdown Syntax Support', desc: 'Renders headers, blockquotes, lists, tables, bold, italics, and code blocks cleanly.' }
      ],
      faqs: [
        { question: 'Can I upload an .md file directly?', answer: 'Yes, you can paste text or drop an `.md` file into the editor.' }
      ]
    }
  },
  {
    id: 'combine-pages-nup',
    name: 'Combine Pages (N-up)',
    slug: 'combine-pages-nup',
    category: 'organize',
    categoryName: 'Organize Pages',
    description: 'Combine multiple PDF pages onto a single sheet (2-up, 4-up, 6-up, 8-up, 9-up, 16-up) for handouts and eco-friendly printing.',
    shortDescription: 'Place multiple pages onto one sheet (2, 4, 6, 9-up grid)',
    iconName: 'LayoutGrid',
    keywords: [
      'combine pages', 'n-up', 'nup', 'multiple pages per sheet', '2-up', '4-up',
      '6-up', '8-up', '9-up', '16-up', 'grid pdf', 'handouts', 'print slides',
      'pages per sheet', 'nup pdf', 'lecture notes', 'eco print'
    ],
    popular: true,
    relatedToolIds: ['merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf'],
    seo: {
      title: 'Combine Pages (N-up) Online – Multiple PDF Pages Per Sheet',
      metaDescription: 'Put multiple PDF pages onto one sheet with 2-up, 4-up, 6-up, or 9-up layouts. Custom margins, borders, and paper sizes with 100% private client-side processing.',
      h1: 'Combine Multiple PDF Pages onto One Sheet (N-up)',
      intro: 'Condense documents, prepare lecture handouts, or print multi-page slides onto single sheets. Choose from 2-up, 4-up, 6-up, 9-up, or custom grids with vector-sharp text.',
      howToSteps: [
        { step: '1. Select PDF File', text: 'Upload or drag and drop the PDF document you want to arrange.' },
        { step: '2. Choose Layout', text: 'Select pages per sheet (2, 4, 6, 8, 9, 16) or set custom rows × columns.' },
        { step: '3. Configure Margins & Spacing', text: 'Adjust sheet size, margins in mm, gaps, reading order, and page borders with live preview.' },
        { step: '4. Download N-up PDF', text: 'Click "Combine Pages" to instantly download your consolidated PDF.' }
      ],
      features: [
        { title: 'Vector-Sharp Quality', desc: 'Pages are embedded as scalable vector Form XObjects without rasterizing or losing text sharpness.' },
        { title: 'Custom Grids & Spacing', desc: 'Full control over rows, columns, margins in millimeters, reading order, and page borders.' },
        { title: '100% Client-Side & Private', desc: 'All processing happens locally on your device with zero server uploads.' }
      ],
      faqs: [
        { question: 'Will my text still be selectable?', answer: 'Yes! PDFCraft embeds the original PDF vector streams so text stays selectable and prints crisply.' },
        { question: 'Can I print slides 2-up or 4-up?', answer: 'Yes! 2-up side-by-side or 4-up grid is ideal for creating printable lecture notes and presentation handouts.' }
      ]
    }
  }
];

export const getToolBySlug = (slug: string): PDFTool | undefined => {
  return TOOLS.find(tool => tool.slug === slug || tool.id === slug || (slug === 'nup-pdf' && tool.id === 'combine-pages-nup'));
};

export const getToolsByCategory = (category: string): PDFTool[] => {
  return TOOLS.filter(tool => tool.category === category);
};

export const searchTools = (query: string): PDFTool[] => {
  const q = query.toLowerCase().trim();
  if (!q) return TOOLS;
  return TOOLS.filter(tool => 
    tool.name.toLowerCase().includes(q) ||
    tool.description.toLowerCase().includes(q) ||
    tool.shortDescription.toLowerCase().includes(q) ||
    tool.keywords.some(k => k.toLowerCase().includes(q)) ||
    tool.categoryName.toLowerCase().includes(q)
  );
};
