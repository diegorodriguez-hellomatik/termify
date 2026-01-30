'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Trash2, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  currentImage: string | null | undefined;
  userName: string | null | undefined;
  token: string | null;
  onAvatarChange?: (newImageUrl: string | null) => void;
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function AvatarUpload({ currentImage, userName, token, onAvatarChange }: AvatarUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get display image (preview > current)
  const displayImage = previewUrl || currentImage;

  // Get initials for fallback avatar
  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      // Show preview immediately
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setError(null);
      setUploadState('uploading');

      try {
        const result = await usersApi.uploadAvatar(file, token);

        if (result.success && result.data) {
          setUploadState('success');
          // Clear preview and use the actual URL
          URL.revokeObjectURL(objectUrl);
          setPreviewUrl(null);
          onAvatarChange?.(result.data.image);

          // Reset to idle after a moment
          setTimeout(() => setUploadState('idle'), 2000);
        } else {
          throw new Error(result.error as string || 'Upload failed');
        }
      } catch (err) {
        setUploadState('error');
        setError(err instanceof Error ? err.message : 'Failed to upload avatar');
        // Keep preview so user can see what they tried to upload
      }
    },
    [token, onAvatarChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleDelete = async () => {
    if (!token) return;

    setUploadState('uploading');
    setError(null);

    try {
      const result = await usersApi.deleteAvatar(token);

      if (result.success) {
        setPreviewUrl(null);
        onAvatarChange?.(null);
        setUploadState('idle');
      } else {
        throw new Error(result.error as string || 'Delete failed');
      }
    } catch (err) {
      setUploadState('error');
      setError(err instanceof Error ? err.message : 'Failed to delete avatar');
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        {/* Avatar Preview */}
        <div
          className={cn(
            'relative group cursor-pointer',
            isDragging && 'ring-2 ring-primary ring-offset-2'
          )}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div
            className={cn(
              'w-24 h-24 rounded-full overflow-hidden border-2 border-border',
              'flex items-center justify-center bg-muted',
              'transition-all duration-200',
              uploadState === 'uploading' && 'opacity-50'
            )}
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-2xl font-semibold">
                {initials}
              </div>
            )}
          </div>

          {/* Overlay on hover */}
          <div
            className={cn(
              'absolute inset-0 rounded-full flex items-center justify-center',
              'bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity',
              uploadState === 'uploading' && 'opacity-100'
            )}
          >
            {uploadState === 'uploading' ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClick}
              disabled={uploadState === 'uploading'}
              className="gap-2"
            >
              <Camera size={14} />
              {currentImage ? 'Change' : 'Upload'}
            </Button>

            {(currentImage || previewUrl) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={uploadState === 'uploading'}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 size={14} />
                Remove
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP or GIF. Max 5MB.
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Success message */}
      {uploadState === 'success' && (
        <p className="text-sm text-green-600">Avatar updated successfully!</p>
      )}
    </div>
  );
}
