'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface ImageUploadProps {
  bucket: 'group-buy-images' | 'avatars';
  folder?: string;
  currentUrl?: string | null;
  onUploaded: (url: string | null) => void;
  label?: string;
  maxSizeMB?: number;
  shape?: 'square' | 'circle';
}

export function ImageUpload({
  bucket,
  folder = '',
  currentUrl,
  onUploaded,
  label = 'Upload image',
  maxSizeMB = 5,
  shape = 'square',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(currentUrl || null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large (max ${maxSizeMB}MB)`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Only image files allowed');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { cacheControl: '3600' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setPreview(publicUrl);
      onUploaded(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    setPreview(null);
    onUploaded(null);
  }

  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div>
      {preview ? (
        <div className="relative inline-block">
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            src={preview}
            alt="Preview"
            className={`${roundedClass} object-cover ${shape === 'circle' ? 'w-32 h-32' : 'w-full max-w-md aspect-video'} border-2 border-slate-200`}
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label
          className={`${roundedClass} border-2 border-dashed border-slate-300 hover:border-yellow-400 hover:bg-yellow-50/50 transition-colors flex flex-col items-center justify-center cursor-pointer ${
            shape === 'circle' ? 'w-32 h-32' : 'w-full max-w-md aspect-video bg-slate-50'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-xs text-slate-500 text-center px-2">{label}</span>
              <span className="text-[10px] text-slate-400 mt-1">PNG, JPG up to {maxSizeMB}MB</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}
