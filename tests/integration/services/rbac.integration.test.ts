/**
 * Integration tests for Simplified 3-Role RBAC System
 * 
 * AIDEV-NOTE: Tests the simplified 3-role system (owner/admin/member) domain logic.
 * Focuses on UserRole value object behavior and capabilities.
 */

import { describe, it, expect } from 'vitest';
import { UserRole } from '@/ddd/domain/shared/value-objects/user-role';

describe('Simplified 3-Role RBAC System', () => {

  describe('UserRole Value Object', () => {
    it('should define correct capabilities for owner role', () => {
      const ownerRole = UserRole.owner();
      
      expect(ownerRole.role).toBe('owner');
      expect(ownerRole.isOwner()).toBe(true);
      expect(ownerRole.isAdministrative()).toBe(true);
      expect(ownerRole.hasCapability('canManageOrganization')).toBe(true);
      expect(ownerRole.hasCapability('canManageUsers')).toBe(true);
      expect(ownerRole.hasCapability('canCreateAgents')).toBe(true);
      expect(ownerRole.hasCapability('canManageAgents')).toBe(true);
      expect(ownerRole.getHierarchyLevel()).toBe(3);
    });

    it('should define correct capabilities for admin role', () => {
      const adminRole = UserRole.admin();
      
      expect(adminRole.role).toBe('admin');
      expect(adminRole.isAdmin()).toBe(true);
      expect(adminRole.isAdministrative()).toBe(true);
      expect(adminRole.hasCapability('canManageOrganization')).toBe(false);
      expect(adminRole.hasCapability('canManageUsers')).toBe(true);
      expect(adminRole.hasCapability('canCreateAgents')).toBe(true);
      expect(adminRole.hasCapability('canManageAgents')).toBe(true);
      expect(adminRole.getHierarchyLevel()).toBe(2);
    });

    it('should define correct capabilities for member role', () => {
      const memberRole = UserRole.member();
      
      expect(memberRole.role).toBe('member');
      expect(memberRole.isMember()).toBe(true);
      expect(memberRole.isAdministrative()).toBe(false);
      expect(memberRole.hasCapability('canManageOrganization')).toBe(false);
      expect(memberRole.hasCapability('canManageUsers')).toBe(false);
      expect(memberRole.hasCapability('canCreateAgents')).toBe(false);
      expect(memberRole.hasCapability('canViewAgents')).toBe(true);
      expect(memberRole.hasCapability('canExecuteAgents')).toBe(true);
      expect(memberRole.getHierarchyLevel()).toBe(1);
    });

    it('should correctly compare role hierarchy', () => {
      const owner = UserRole.owner();
      const admin = UserRole.admin();
      const member = UserRole.member();

      expect(owner.hasHigherPrivilegesThan(admin)).toBe(true);
      expect(admin.hasHigherPrivilegesThan(member)).toBe(true);
      expect(owner.hasHigherPrivilegesThan(member)).toBe(true);
      
      expect(member.hasHigherPrivilegesThan(admin)).toBe(false);
      expect(admin.hasHigherPrivilegesThan(owner)).toBe(false);
    });

    it('should validate role creation from string', () => {
      expect(() => UserRole.fromString('invalid-role')).toThrow();
      expect(() => UserRole.fromString('owner')).not.toThrow();
      expect(() => UserRole.fromString('admin')).not.toThrow();
      expect(() => UserRole.fromString('member')).not.toThrow();
    });
  });

});