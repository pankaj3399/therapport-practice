import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NextOfKinTabProps } from './types';

export const NextOfKinTab: React.FC<NextOfKinTabProps> = ({
    form,
    saving,
    onChange,
    onSave,
}) => {
    return (
        <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nokName">Full Name</Label>
                    <Input
                        id="nokName"
                        value={form.name}
                        onChange={(e) => onChange({ ...form, name: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="nokRelationship">Relationship</Label>
                    <Input
                        id="nokRelationship"
                        value={form.relationship}
                        onChange={(e) => onChange({ ...form, relationship: e.target.value })}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nokPhone">Phone</Label>
                    <Input
                        id="nokPhone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => onChange({ ...form, phone: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="nokEmail">Email</Label>
                    <Input
                        id="nokEmail"
                        type="email"
                        value={form.email}
                        onChange={(e) => onChange({ ...form, email: e.target.value })}
                    />
                </div>
            </div>
            <Button onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Next of Kin'}
            </Button>
        </div>
    );
};
