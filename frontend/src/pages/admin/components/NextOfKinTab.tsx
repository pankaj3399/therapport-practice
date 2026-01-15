import React, { useState } from 'react';
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
    const [errors, setErrors] = useState<Record<string, string>>({});

    const FIELD_LABELS: Record<string, string> = {
        name: "Full Name",
        relationship: "Relationship",
        phone: "Phone Number",
        email: "Email Address"
    };

    const validateField = (field: string, value: string) => {
        if (!value.trim()) {
            const label = FIELD_LABELS[field] || field.charAt(0).toUpperCase() + field.slice(1);
            setErrors(prev => ({ ...prev, [field]: `${label} is required` }));
            return false;
        }
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
        return true;
    };

    const handleSave = () => {
        const nameValid = validateField('name', form.name);
        const relValid = validateField('relationship', form.relationship);
        const phoneValid = validateField('phone', form.phone);

        if (nameValid && relValid && phoneValid) {
            onSave();
        }
    };

    const hasErrors = Object.keys(errors).length > 0;
    const isFormIncomplete = !form.name || !form.relationship || !form.phone;

    return (
        <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nokName">Full Name <span className="text-red-500">*</span></Label>
                    <Input
                        id="nokName"
                        value={form.name}
                        onChange={(e) => {
                            onChange({ ...form, name: e.target.value });
                            if (errors.name) validateField('name', e.target.value);
                        }}
                        onBlur={() => validateField('name', form.name)}
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? "nokName-error" : undefined}
                        className={errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.name && (
                        <p id="nokName-error" className="text-sm text-red-500 mt-1">{errors.name}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="nokRelationship">Relationship <span className="text-red-500">*</span></Label>
                    <Input
                        id="nokRelationship"
                        value={form.relationship}
                        onChange={(e) => {
                            onChange({ ...form, relationship: e.target.value });
                            if (errors.relationship) validateField('relationship', e.target.value);
                        }}
                        onBlur={() => validateField('relationship', form.relationship)}
                        aria-invalid={!!errors.relationship}
                        aria-describedby={errors.relationship ? "nokRelationship-error" : undefined}
                        className={errors.relationship ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.relationship && (
                        <p id="nokRelationship-error" className="text-sm text-red-500 mt-1">{errors.relationship}</p>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nokPhone">Phone <span className="text-red-500">*</span></Label>
                    <Input
                        id="nokPhone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => {
                            onChange({ ...form, phone: e.target.value });
                            if (errors.phone) validateField('phone', e.target.value);
                        }}
                        onBlur={() => validateField('phone', form.phone)}
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? "nokPhone-error" : undefined}
                        className={errors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    {errors.phone && (
                        <p id="nokPhone-error" className="text-sm text-red-500 mt-1">{errors.phone}</p>
                    )}
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
            <Button onClick={handleSave} disabled={saving || hasErrors || isFormIncomplete}>
                {saving ? 'Saving...' : 'Save Next of Kin'}
            </Button>
        </div>
    );
};
