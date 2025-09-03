declare global {
  namespace React {
    interface InputHTMLAttributes {
      webkitdirectory?: string;
    }
  }
  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}

declare module '*.worker.ts' {
  class WebpackWorker extends Worker {
    constructor();
  }
  export default WebpackWorker;
}

declare module '*file-processor.worker.ts' {
  class FileProcessorWorker extends Worker {
    constructor();
  }
  export default FileProcessorWorker;
}

declare module '*file-reader.worker.ts' {
  class FileReaderWorker extends Worker {
    constructor();
  }
  export default FileReaderWorker;
}

declare module '*directory-traverser.worker.ts' {
  class DirectoryTraverserWorker extends Worker {
    constructor();
  }
  export default DirectoryTraverserWorker;
}


export { };
