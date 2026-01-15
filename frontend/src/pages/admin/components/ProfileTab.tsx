import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select-native';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ProfileTabProps } from './types';
import { UserStatus } from '@/types';
import { USER_STATUS_OPTIONS } from '@/constants';

export const ProfileTab: React.FC<ProfileTabProps> = ({
    firstName,
    lastName,
    phone,
    status,
    saving,
    onChange,
    onSave,
    onDelete,
    practitionerName,
}) => {
    return (
        <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => onChange({ firstName: e.target.value, lastName, phone, status })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => onChange({ firstName, lastName: e.target.value, phone, status })}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => onChange({ firstName, lastName, phone: e.target.value, status })}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="status">Account Status</Label>
                <Select
                    id="status"
                    value={status}
                    onChange={(e) => onChange({ firstName, lastName, phone, status: e.target.value as UserStatus })}
                >
                    {USER_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </Select>
            </div>
            <div className="flex gap-2">
                <Button onClick={onSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Profile'}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={saving}>
                            Delete User
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Practitioner?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete {practitionerName} and all their data (bookings, documents, invoices). This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={onDelete}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={saving}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};
