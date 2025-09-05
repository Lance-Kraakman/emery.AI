import { getOrganizationMembers, getPendingInvitations, inviteUser } from "@/app/actions/invitations";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UserManagementPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Organization Selected</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please select an organization to manage users.</p>
          <p className="text-sm text-muted-foreground mt-2">
            You can switch or create organizations using the switcher in the sidebar.
          </p>
        </CardContent>
      </Card>
    );
  }

  const members = await getOrganizationMembers();
  const pendingInvitations = await getPendingInvitations();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite New Member</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="flex items-center gap-4">
            <Input type="email" name="email" placeholder="user@example.com" required />
            <Select name="role" defaultValue="member">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Send Invitation</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <p className="font-semibold">{member.name || 'Unnamed User'}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <div className="text-sm capitalize bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                  {member.role}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id.value} className="flex items-center justify-between p-2 border rounded-lg">
                <p>{typeof invitation.email === 'string' ? invitation.email : invitation.email?.value}</p>
                <p className="text-sm text-muted-foreground">Role: {typeof invitation.role === 'string' ? invitation.role : invitation.role?.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
