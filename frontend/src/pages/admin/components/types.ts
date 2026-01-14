import { UserStatus } from '@/types';

// Defining shared interfaces for the sub-components
export interface ProfileTabProps {
    firstName: string;
    lastName: string;
    phone: string;
    status: UserStatus;
    saving: boolean;
    onChange: (data: { firstName: string; lastName: string; phone: string; status: UserStatus }) => void;
    onSave: () => void;
    onDelete: () => void;
    practitionerName: string;
}

export interface MembershipTabProps {
    membershipType: 'permanent' | 'ad_hoc' | '';
    marketingAddon: boolean;
    saving: boolean;
    onTypeChange: (type: 'permanent' | 'ad_hoc' | '') => void;
    onAddonChange: (addon: boolean) => void;
    onSave: () => void;
}

export interface NextOfKinTabProps {
    form: {
        name: string;
        relationship: string;
        phone: string;
        email: string;
    };
    saving: boolean;
    onChange: (data: { name: string; relationship: string; phone: string; email: string }) => void;
    onSave: () => void;
}

export interface ClinicalTabProps {
    documents: Array<{
        id: string;
        documentType: 'insurance' | 'clinical_registration';
        fileName: string;
        fileUrl: string;
        expiryDate: string | null;
        createdAt: string;
    }>;
    executorForm: {
        name: string;
        email: string;
        phone: string;
    };
    saving: boolean;
    onExecutorChange: (data: { name: string; email: string; phone: string }) => void;
    onSaveExecutor: () => void;
}
