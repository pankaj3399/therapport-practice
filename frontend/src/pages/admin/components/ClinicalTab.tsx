import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/Icon';
import { ClinicalTabProps } from './types';

export const ClinicalTab: React.FC<ClinicalTabProps> = ({
    documents,
    executorForm,
    saving,
    onExecutorChange,
    onSaveExecutor,
}) => {
    const isExpired = (dateStr: string | null) => {
        if (!dateStr) return false;
        return new Date(dateStr) < new Date();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
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
                            return (
                                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                                            <Icon name="file" className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">
                                                {doc.documentType === 'insurance' ? 'Insurance' : 'Clinical Registration'}
                                            </p>
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
                                    <div>
                                        {doc.expiryDate ? (
                                            <Badge variant={expired ? "destructive" : "outline"} className={expired ? "" : "text-green-600 border-green-200 bg-green-50"}>
                                                {expired ? 'Expired' : `Exp: ${formatDate(doc.expiryDate)}`}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">No expiry</Badge>
                                        )}
                                    </div>
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
