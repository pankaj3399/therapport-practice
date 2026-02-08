import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/Icon';
import { ClinicalTabProps } from './types';
import { adminApi } from '@/services/api';

const isExpired = (dateStr: string | null) => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString();
};

const documentTypeLabel = (docType: string) => {
  if (docType === 'insurance') return 'Insurance';
  if (docType === 'clinical_registration') return 'Clinical Registration';
  if (docType === 'reference') return 'Reference';
  return docType;
};

export const ClinicalTab: React.FC<ClinicalTabProps> = ({
  documents,
  executorForm,
  saving,
  onExecutorChange,
  onSaveExecutor,
  onUpdateExpiry,
  onReferenceUploaded,
  practitionerId,
}) => {
  const [editingExpiry, setEditingExpiry] = useState<{ [key: string]: string }>({});
  const [savingExpiry, setSavingExpiry] = useState<{ [key: string]: boolean }>({});
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceDoc = documents.find((d) => d.documentType === 'reference');

  const handleEditExpiry = (docId: string, currentExpiry: string | null) => {
    setEditingExpiry({
      ...editingExpiry,
      [docId]: currentExpiry ? currentExpiry.split('T')[0] : '',
    });
  };

  const handleCancelEdit = (docId: string) => {
    const newEditing = { ...editingExpiry };
    delete newEditing[docId];
    setEditingExpiry(newEditing);
  };

  const handleSaveExpiry = async (docId: string) => {
    const expiryValue = editingExpiry[docId];
    const expiryDate = expiryValue && expiryValue.trim() ? expiryValue.trim() : null;

    setSavingExpiry({ ...savingExpiry, [docId]: true });
    try {
      await onUpdateExpiry(docId, expiryDate);
      const newEditing = { ...editingExpiry };
      delete newEditing[docId];
      setEditingExpiry(newEditing);
    } catch (error) {
      console.error('Failed to update expiry date:', error);
    } finally {
      const newSaving = { ...savingExpiry };
      delete newSaving[docId];
      setSavingExpiry(newSaving);
    }
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Documents Section */}
      <div>
        <h3 className="text-lg font-medium mb-4">Professional Documents</h3>
        {documents.length > 0 ? (
          <div className="grid gap-4">
            {documents.map((doc) => {
              const expired = isExpired(doc.expiryDate);
              const isEditing = editingExpiry[doc.id] !== undefined;
              const isSaving = savingExpiry[doc.id] === true;

              return (
                <div
                  key={doc.id}
                  className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                        <Icon name="description" className="h-5 w-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{documentTypeLabel(doc.documentType)}</p>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {doc.fileName}
                        </a>
                      </div>
                    </div>
                    {!isEditing && doc.documentType !== 'reference' && (
                      <div className="flex items-center gap-2">
                        {doc.expiryDate ? (
                          <Badge
                            variant={expired ? 'destructive' : 'outline'}
                            className={expired ? '' : 'text-green-600 border-green-200 bg-green-50'}
                          >
                            {expired ? 'Expired' : `Exp: ${formatDate(doc.expiryDate)}`}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No expiry</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditExpiry(doc.id, doc.expiryDate)}
                          disabled={isSaving}
                        >
                          <Icon name="edit" size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing && doc.documentType !== 'reference' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`expiry-${doc.id}`} className="text-xs">
                          Expiry Date
                        </Label>
                        <Input
                          id={`expiry-${doc.id}`}
                          type="date"
                          value={editingExpiry[doc.id] || ''}
                          onChange={(e) =>
                            setEditingExpiry({ ...editingExpiry, [doc.id]: e.target.value })
                          }
                          disabled={isSaving}
                        />
                      </div>
                      <div className="flex gap-2 pt-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveExpiry(doc.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelEdit(doc.id)}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
            No documents uploaded yet
          </div>
        )}
      </div>

      {/* Reference document (one per practitioner, admin upload) */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <h3 className="text-lg font-medium mb-4">Reference document</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !practitionerId) return;
            e.target.value = '';
            setReferenceError(null);
            setReferenceUploading(true);
            try {
              const urlRes = await adminApi.getReferenceUploadUrl(practitionerId, {
                filename: file.name,
                fileType: file.type,
                fileSize: file.size,
              });
              const {
                presignedUrl,
                filePath,
                oldDocumentId: responseOldId,
              } = urlRes.data.data ?? {};
              if (!presignedUrl || !filePath) throw new Error('Invalid upload URL response');
              const oldDocumentId = referenceDoc?.id ?? responseOldId;
              const res = await fetch(presignedUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
              });
              if (!res.ok) {
                const status = res.status;
                throw new Error(
                  status >= 400 && status < 500
                    ? 'Upload was rejected. Please check the file and try again.'
                    : 'Upload to storage failed. Please try again.'
                );
              }
              await adminApi.confirmReferenceUpload(practitionerId, {
                filePath,
                fileName: file.name,
                oldDocumentId,
              });
              onReferenceUploaded?.();
            } catch (err: unknown) {
              const apiError =
                err && typeof err === 'object' && 'response' in err
                  ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
                  : null;
              const msg = apiError ?? (err instanceof Error ? err.message : null);
              setReferenceError(msg ?? 'Upload failed');
            } finally {
              setReferenceUploading(false);
            }
          }}
        />
        {referenceDoc ? (
          <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                  <Icon name="description" className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Reference</p>
                  <a
                    href={referenceDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {referenceDoc.fileName}
                  </a>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={referenceUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {referenceUploading ? 'Uploading…' : 'Replace'}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={referenceUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {referenceUploading ? 'Uploading…' : 'Upload reference'}
            </Button>
          </div>
        )}
        {referenceError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{referenceError}</p>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
        <h3 className="text-lg font-medium mb-4">Clinical Executor</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="ceName">Name</Label>
            <Input
              id="ceName"
              value={executorForm.name}
              onChange={(e) => onExecutorChange({ ...executorForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ceEmail">Email</Label>
            <Input
              id="ceEmail"
              type="email"
              value={executorForm.email}
              onChange={(e) => onExecutorChange({ ...executorForm, email: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <Label htmlFor="cePhone">Phone</Label>
          <Input
            id="cePhone"
            type="tel"
            value={executorForm.phone}
            onChange={(e) => onExecutorChange({ ...executorForm, phone: e.target.value })}
          />
        </div>
        <Button onClick={onSaveExecutor} disabled={saving}>
          {saving ? 'Saving...' : 'Save Clinical Executor'}
        </Button>
      </div>
    </div>
  );
};
