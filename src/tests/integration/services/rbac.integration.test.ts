/**
 * Integration tests for RBAC System
 * 
 * AIDEV-NOTE: Tests the RBAC system role constants and validation.
 * Focuses on SystemRoleType constants and role validation functions.
 */

import { describe, it, expect } from 'vitest';
import { SYSTEM_ROLES, SystemRoleType, isSystemRole } from '@/src/ddd/domain/rbac/entities/role';

describe('RBAC System', () => {

  describe('System Role Constants', () => {
    it('should define all expected system roles', () => {
      expect(SYSTEM_ROLES.ORGANIZATION_OWNER).toBe('Organization Owner');
      expect(SYSTEM_ROLES.ORGANIZATION_ADMIN).toBe('Organization Admin');
      expect(SYSTEM_ROLES.TEAM_LEAD).toBe('Team Lead');
      expect(SYSTEM_ROLES.MEMBER).toBe('Member');
      expect(SYSTEM_ROLES.VIEWER).toBe('Viewer');
    });

    it('should validate system roles correctly', () => {
      expect(isSystemRole('Organization Owner')).toBe(true);
      expect(isSystemRole('Organization Admin')).toBe(true);
      expect(isSystemRole('Team Lead')).toBe(true);
      expect(isSystemRole('Member')).toBe(true);
      expect(isSystemRole('Viewer')).toBe(true);
      
      expect(isSystemRole('invalid-role')).toBe(false);
      expect(isSystemRole('owner')).toBe(false); // Legacy role name
      expect(isSystemRole('admin')).toBe(false); // Legacy role name
    });

    it('should have proper TypeScript typing for SystemRoleType', () => {
      const organizationOwner: SystemRoleType = SYSTEM_ROLES.ORGANIZATION_OWNER;
      const organizationAdmin: SystemRoleType = SYSTEM_ROLES.ORGANIZATION_ADMIN;
      const teamLead: SystemRoleType = SYSTEM_ROLES.TEAM_LEAD;
      const member: SystemRoleType = SYSTEM_ROLES.MEMBER;
      const viewer: SystemRoleType = SYSTEM_ROLES.VIEWER;
      
      expect(organizationOwner).toBe('Organization Owner');
      expect(organizationAdmin).toBe('Organization Admin');
      expect(teamLead).toBe('Team Lead');
      expect(member).toBe('Member');
      expect(viewer).toBe('Viewer');
    });
  });

});