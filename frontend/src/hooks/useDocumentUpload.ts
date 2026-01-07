import { useState } from 'react';
import api from '@/services/api';

export interface DocumentData {
  id: string;
  fileName: string;
  expiryDate: string;
  documentUrl: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
}

interface UseDocumentUploadOptions {
  baseEndpoint: string;
  onSuccess: (document: DocumentData) => void;
  setMessage: (message: { type: 'success' | 'error'; text: string } | null) => void;
  successMessage?: string;
}

interface UseDocumentUploadReturn {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  expiryDate: string;
  setExpiryDate: (date: string) => void;
  uploading: boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => Promise<void>;
  handleCancel: () => void;
  error: string | null;
}

export const useDocumentUpload = ({
  baseEndpoint,
  onSuccess,
  setMessage,
  successMessage = 'Document uploaded successfully',
}: UseDocumentUploadOptions): UseDocumentUploadReturn => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = 'Please select a PDF or image file (PDF, JPG, PNG)';
      setError(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      const errorMsg = 'File size must be less than 10MB';
      setError(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setExpiryDate('');
    setError(null);
    setMessage(null);
  };

  const handleUpload = async () => {
    // Guard against concurrent uploads
    if (uploading) {
      return;
    }

    // Validate file and expiry date
    if (!selectedFile) {
      const errorMsg = 'No file selected';
      setError(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      return;
    }

    if (!expiryDate) {
      const errorMsg = 'Please select an expiry date';
      setError(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      return;
    }

    // Validate expiry date is in the future
    const expiry = new Date(expiryDate);
    expiry.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (expiry < today) {
      const errorMsg = 'Expiry date must be in the future';
      setError(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      return;
    }

    // Set uploading state synchronously before any awaits
    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      // Step 1: Get presigned URL from backend
      const uploadUrlResponse = await api.post(`${baseEndpoint}/upload-url`, {
        filename: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        expiryDate: expiryDate,
      });

      if (!uploadUrlResponse.data.success) {
        throw new Error(uploadUrlResponse.data.error || 'Failed to get upload URL');
      }

      const { presignedUrl, filePath, oldDocumentId } = uploadUrlResponse.data.data;

      // Step 2: Upload file directly to R2 with timeout/abort handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 30000); // 30 second timeout

      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile.type,
          },
          signal: abortController.signal,
        });
        // Clear timeout if upload completes successfully
        clearTimeout(timeoutId);
      } catch (error: any) {
        // Clear timeout in case of error
        clearTimeout(timeoutId);
        
        // Handle abort/timeout errors
        if (error.name === 'AbortError' || error.name === 'DOMException') {
          throw new Error('Upload timed out. Please try again.');
        }
        // Re-throw other errors
        throw error;
      }

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Confirm upload with backend
      const confirmResponse = await api.put(`${baseEndpoint}/confirm`, {
        filePath,
        fileName: selectedFile.name,
        expiryDate: expiryDate,
        oldDocumentId: oldDocumentId || undefined,
      });

      if (confirmResponse.data.success && confirmResponse.data.data) {
        const confirmData = confirmResponse.data.data;
        
        // Check if expiry status fields are present in confirm response
        if (
          typeof confirmData.isExpired === 'boolean' &&
          typeof confirmData.isExpiringSoon === 'boolean' &&
          (confirmData.daysUntilExpiry === null || typeof confirmData.daysUntilExpiry === 'number')
        ) {
          // Use confirm response data directly
          const documentData: DocumentData = {
            id: confirmData.id,
            fileName: confirmData.fileName,
            expiryDate: confirmData.expiryDate,
            documentUrl: confirmData.documentUrl,
            isExpired: confirmData.isExpired,
            isExpiringSoon: confirmData.isExpiringSoon,
            daysUntilExpiry: confirmData.daysUntilExpiry,
          };
          onSuccess(documentData);
        } else {
          // Fallback to GET request if expiry fields are missing
          const docResponse = await api.get(baseEndpoint);
          if (docResponse.data.success && docResponse.data.data) {
            onSuccess(docResponse.data.data);
          }
        }
        
        setMessage({ type: 'success', text: successMessage });
        setSelectedFile(null);
        setExpiryDate('');
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to upload document';
      setError(errorMsg);
      setMessage({
        type: 'error',
        text: errorMsg,
      });
    } finally {
      setUploading(false);
    }
  };

  return {
    selectedFile,
    setSelectedFile,
    expiryDate,
    setExpiryDate,
    uploading,
    handleFileSelect,
    handleUpload,
    handleCancel,
    error,
  };
};

