import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface Props {
  onFileChange: (file: File | null) => void;
  currentFile?: File | null;
  accept?: string;
  hintText?: string;
}

const FileDropzone = ({ onFileChange, currentFile, accept, hintText }: Props) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragIn = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragOut = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    onFileChange(e.dataTransfer.files?.[0] ?? null);
  };
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onFileChange(e.target.files?.[0] ?? null);
  const handleClear = () => { onFileChange(null); if (inputRef.current) inputRef.current.value = ""; };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={isDragging ? "dropzone dropzone--dragging" : "dropzone"}
      >
        <svg
          className={isDragging ? "dropzone-icon dropzone-icon--dragging" : "dropzone-icon"}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        {currentFile ? (
          <p className="dropzone-filename">{currentFile.name}</p>
        ) : (
          <>
            <p className="dropzone-hint">
              <span className="dropzone-hint-bold">Click to browse</span>{" or drag & drop"}
            </p>
            <p className="dropzone-hint-sub">{hintText ?? "Any file type accepted"}</p>
          </>
        )}
        <input ref={inputRef} type="file" style={{ display: "none" }} accept={accept} onChange={handleChange} />
      </div>
      {currentFile && (
        <div className="dropzone-meta">
          <span className="dropzone-meta-name">{currentFile.name}</span>
          <span className="dropzone-meta-size">({(currentFile.size / 1024).toFixed(1)} KB)</span>
          <button type="button" onClick={handleClear} className="dropzone-remove">Remove</button>
        </div>
      )}
    </div>
  );
};

export default FileDropzone;
