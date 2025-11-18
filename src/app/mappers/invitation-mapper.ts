/**
 * Invitation Mapper - Converts between domain entities and DTOs
 *
 * AIDEV-NOTE: Ensures proper serialization of Invitation entities for Client Components
 * Following the pattern established in other mappers
 */

import type { Invitation } from "@/ddd/domain/invitations/entities/invitation";
import type { InvitationDTO } from "@/app/dtos/invitation.dto";

/**
 * Maps an Invitation domain entity to a plain DTO object
 * This is necessary because Next.js cannot serialize class instances to Client Components
 */
export function toInvitationDTO(invitation: Invitation): InvitationDTO {
  return {
    id: invitation.id.value,
    organizationId: invitation.organizationId.value,
    invitedBy: invitation.invitedBy.value,
    email: invitation.email.value,
    systemRole: invitation.systemRole,
    token: invitation.token.value,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    isExpired: invitation.isExpired(),
    daysUntilExpiry: invitation.getDaysUntilExpiry(),
  };
}

/**
 * Maps an array of Invitation domain entities to DTOs
 */
export function toInvitationDTOs(invitations: Invitation[]): InvitationDTO[] {
  return invitations.map(toInvitationDTO);
}
