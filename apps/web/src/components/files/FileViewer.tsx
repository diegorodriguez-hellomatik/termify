'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Loader2,
  AlertCircle,
  FileCode,
  FileImage,
  FileVideo,
  FileText,
  File,
  Download,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileViewerProps {
  terminalId: string;
  filePath: string;
  fileName: string;
  extension?: string;
  className?: string;
}

interface FileData {
  path: string;
  name: string;
  extension: string;
  size: number;
  isBinary: boolean;
  isTruncated: boolean;
  content: string | null;
  message?: string;
  modifiedAt?: string;
}

// Code syntax highlighting colors based on extension
function getLanguageClass(extension?: string): string {
  switch (extension) {
    case 'ts':
    case 'tsx':
      return 'language-typescript';
    case 'js':
    case 'jsx':
      return 'language-javascript';
    case 'py':
      return 'language-python';
    case 'json':
      return 'language-json';
    case 'css':
    case 'scss':
      return 'language-css';
    case 'html':
      return 'language-html';
    case 'md':
      return 'language-markdown';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'language-bash';
    case 'yaml':
    case 'yml':
      return 'language-yaml';
    case 'php':
      return 'language-php';
    case 'go':
      return 'language-go';
    case 'rs':
      return 'language-rust';
    case 'java':
      return 'language-java';
    case 'c':
    case 'cpp':
    case 'h':
      return 'language-cpp';
    default:
      return 'language-plaintext';
  }
}

// Check if extension is for an image
function isImageExtension(ext?: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext || '');
}

// Check if extension is for a video
function isVideoExtension(ext?: string): boolean {
  return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '');
}

// Check if extension is for audio
function isAudioExtension(ext?: string): boolean {
  return ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext || '');
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileViewer({ terminalId, filePath, fileName, extension, className }: FileViewerProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchFile = async () => {
      if (!session?.accessToken) return;

      setLoading(true);
      setError(null);
      setBinaryUrl(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // For binary files (images, videos, audio), fetch as blob
      if (isImageExtension(extension) || isVideoExtension(extension) || isAudioExtension(extension)) {
        try {
          const response = await fetch(
            `${apiUrl}/api/terminals/${terminalId}/file/binary?path=${encodeURIComponent(filePath)}`,
            {
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
              },
            }
          );

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setBinaryUrl(url);
            setFileData({
              path: filePath,
              name: fileName,
              extension: extension || '',
              size: blob.size,
              isBinary: true,
              isTruncated: false,
              content: null,
            });
            setLoading(false);
            return;
          }
        } catch (err) {
          // Fall through to text fetch
        }
      }

      // Fetch as text
      try {
        const response = await fetch(
          `${apiUrl}/api/terminals/${terminalId}/file?path=${encodeURIComponent(filePath)}`,
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch file');
        }

        const data = await response.json();
        setFileData(data.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    fetchFile();

    // Cleanup blob URL on unmount
    return () => {
      if (binaryUrl) {
        URL.revokeObjectURL(binaryUrl);
      }
    };
  }, [terminalId, filePath, fileName, extension, session?.accessToken]);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-background', className)}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading {fileName}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-background', className)}>
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <span className="text-sm font-medium">Failed to load file</span>
          <span className="text-xs text-muted-foreground">{error}</span>
        </div>
      </div>
    );
  }

  if (!fileData) {
    return null;
  }

  // Render image
  if (isImageExtension(extension) && binaryUrl) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <FileImage className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">{fileName}</span>
            <span className="text-xs text-muted-foreground">({formatSize(fileData.size)})</span>
          </div>
          <a
            href={binaryUrl}
            download={fileName}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
        {/* Image viewer */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#1a1a1a]">
          <img
            src={binaryUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>
    );
  }

  // Render video
  if (isVideoExtension(extension) && binaryUrl) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <FileVideo className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">{fileName}</span>
            <span className="text-xs text-muted-foreground">({formatSize(fileData.size)})</span>
          </div>
          <a
            href={binaryUrl}
            download={fileName}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
        {/* Video player */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-black">
          <video
            src={binaryUrl}
            controls
            className="max-w-full max-h-full"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    );
  }

  // Render audio
  if (isAudioExtension(extension) && binaryUrl) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <File className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">{fileName}</span>
            <span className="text-xs text-muted-foreground">({formatSize(fileData.size)})</span>
          </div>
          <a
            href={binaryUrl}
            download={fileName}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
        {/* Audio player */}
        <div className="flex-1 flex items-center justify-center p-8">
          <audio
            src={binaryUrl}
            controls
            className="w-full max-w-md"
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
    );
  }

  // Binary file that we can't display
  if (fileData.isBinary) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <File className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName}</span>
            <span className="text-xs text-muted-foreground">({formatSize(fileData.size)})</span>
          </div>
        </div>
        {/* Message */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <File className="h-16 w-16 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {fileData.message || 'Binary file cannot be displayed'}
            </p>
            <p className="text-xs text-muted-foreground">{formatSize(fileData.size)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Truncated file
  if (fileData.isTruncated) {
    return (
      <div className={cn('flex flex-col h-full bg-background', className)}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName}</span>
            <span className="text-xs text-muted-foreground">({formatSize(fileData.size)})</span>
          </div>
        </div>
        {/* Message */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <FileText className="h-16 w-16 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {fileData.message || 'File too large to display'}
            </p>
            <p className="text-xs text-muted-foreground">{formatSize(fileData.size)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render code/text file
  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{fileName}</span>
          <span className="text-xs text-muted-foreground">
            ({formatSize(fileData.size)} | {fileData.content?.split('\n').length || 0} lines)
          </span>
        </div>
        {fileData.modifiedAt && (
          <span className="text-xs text-muted-foreground">
            Modified: {new Date(fileData.modifiedAt).toLocaleString()}
          </span>
        )}
      </div>
      {/* Code viewer */}
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-sm font-mono leading-relaxed">
          <code className={getLanguageClass(extension)}>
            {fileData.content?.split('\n').map((line, i) => (
              <div key={i} className="flex hover:bg-muted/30">
                <span className="select-none text-muted-foreground w-12 pr-4 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
