import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/appStore';

interface PfpPickerProps {
  pfps: string[];
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function PfpPicker({ pfps, onSelect, onClose }: PfpPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { authUser } = useAppStore();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    setUploadError(null);

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a PNG, JPEG, or WebP image');
      return;
    }

    // Validate file size (2MB limit)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('Image must be smaller than 2MB');
      return;
    }

    // Validate dimensions
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (event) => {
      img.onload = async () => {
        if (img.width < 100 || img.height < 100) {
          setUploadError('Image must be at least 100x100 pixels');
          return;
        }
        if (img.width > 2000 || img.height > 2000) {
          setUploadError('Image must be smaller than 2000x2000 pixels');
          return;
        }

        // Upload to Supabase storage
        setUploading(true);
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `custom_${authUser.id}.${fileExt}`;
          const filePath = fileName;

          // Delete existing custom avatar if any
          await supabase.storage
            .from('profile-pictures')
            .remove([`custom_${authUser.id}.png`, `custom_${authUser.id}.jpg`, `custom_${authUser.id}.jpeg`, `custom_${authUser.id}.webp`]);

          // Upload new avatar
          const { error: uploadError } = await supabase.storage
            .from('profile-pictures')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(filePath);

          // Update user profile with new avatar URL
          onSelect(publicUrl);
          onClose();
        } catch (error) {
          console.error('Error uploading avatar:', error);
          setUploadError('Failed to upload image. Please try again.');
        } finally {
          setUploading(false);
        }
      };
      img.src = event.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="modal-content pfp-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select a Profile Picture</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          {uploadError && (
            <div style={{ color: 'var(--error-color, #ef4444)', marginBottom: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
              {uploadError}
            </div>
          )}
          <div className="pfp-grid">
            {pfps.map((url: string, idx: number) => (
              <img
                key={url + '-' + idx}
                src={url}
                alt="Profile"
                className="pfp-option"
                onClick={() => onSelect(url)}
              />
            ))}
            {/* Custom upload button */}
            <button
              className="pfp-option pfp-upload-button"
              onClick={handleUploadClick}
              disabled={uploading}
              title="Upload your own"
              aria-label="Upload custom avatar"
            >
              {uploading ? (
                <span style={{ fontSize: '1.5rem' }}>⏳</span>
              ) : (
                <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>+</span>
              )}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
