import { UserStatus } from '@/types';

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'rejected', label: 'Rejected' },
];
