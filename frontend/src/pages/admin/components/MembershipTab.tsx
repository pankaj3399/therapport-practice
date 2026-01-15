import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select-native';
import { Checkbox } from '@/components/ui/checkbox-native';
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
        <Select
          id="membershipType"
          value={membershipType}
          onChange={(e) => onTypeChange(e.target.value as 'permanent' | 'ad_hoc' | '')}
        >
          <option value="" disabled>
            Select a membership type
          </option>
          <option value="permanent">Permanent</option>
          <option value="ad_hoc">Ad Hoc</option>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="marketingAddon"
          checked={marketingAddon}
          onChange={(e) => onAddonChange(e.target.checked)}
          disabled={membershipType !== 'permanent'}
        />
        <Label
          htmlFor="marketingAddon"
          className={membershipType !== 'permanent' ? 'text-slate-400' : ''}
        >
          Enable Marketing Add-on
        </Label>
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Membership'}
      </Button>
    </div>
  );
};
