import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MembershipTabProps } from './types';

export const MembershipTab: React.FC<MembershipTabProps> = ({
    membershipType,
    marketingAddon,
    saving,
    onTypeChange,
    onAddonChange,
    onSave,
}) => {
    return (
        <div className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="membershipType">Membership Type</Label>
                <select
                    id="membershipType"
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                    value={membershipType}
                    onChange={(e) => onTypeChange(e.target.value as 'permanent' | 'ad_hoc' | '')}
                >
                    <option value="" disabled>Select a membership type</option>
                    <option value="permanent">Permanent</option>
                    <option value="ad_hoc">Ad Hoc</option>
                </select>
            </div>

            <div className="flex items-center space-x-2">
                <input
                    type="checkbox"
                    id="marketingAddon"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={marketingAddon}
                    onChange={(e) => onAddonChange(e.target.checked)}
                    disabled={membershipType !== 'permanent'}
                />
                <Label htmlFor="marketingAddon" className={membershipType !== 'permanent' ? 'text-slate-400' : ''}>
                    Enable Marketing Add-on (Permanent members only)
                </Label>
            </div>

            <Button onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Membership'}
            </Button>
        </div>
    );
};
