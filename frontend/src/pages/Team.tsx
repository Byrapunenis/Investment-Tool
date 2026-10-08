import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiErrorMessage, listWorkspaceMembers, updateMemberPermissions } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Team() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membersQuery = useQuery({ queryKey: ['workspace-members'], queryFn: listWorkspaceMembers });

  const setPermission = useMutation({
    mutationFn: ({ memberId, canEdit }: { memberId: number; canEdit: boolean }) =>
      updateMemberPermissions(memberId, canEdit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
    },
  });

  const members = membersQuery.data ?? [];

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">Only the workspace admin can view the team page.</div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Team</h2>
      <p className="page-subtitle">
        Members who join with your invite code start view-only. Grant permission below to let
        them add or delete properties.
      </p>

      {membersQuery.error && (
        <div className="error-banner">{apiErrorMessage(membersQuery.error)}</div>
      )}
      {setPermission.isError && (
        <div className="error-banner">{apiErrorMessage(setPermission.error)}</div>
      )}
      {membersQuery.isLoading && <p>Loading…</p>}

      <div className="card">
        <h2>Members ({members.length})</h2>
        {members.length === 0 ? (
          <div className="empty-state">No members yet.</div>
        ) : (
          <div className="property-list">
            {members.map((m) => (
              <div key={m.id} className="property-row">
                <div>
                  <strong>
                    {m.first_name} {m.last_name}
                  </strong>{' '}
                  <span style={{ color: 'var(--text-dim)' }}>{m.email}</span>
                  <div style={{ marginTop: 4 }}>
                    <span className="badge cash">{m.role === 'admin' ? 'Admin' : 'Member'}</span>
                  </div>
                </div>
                {m.role === 'admin' ? (
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Full permissions</span>
                ) : (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={m.can_edit_properties}
                      disabled={setPermission.isPending}
                      onChange={(e) =>
                        setPermission.mutate({ memberId: m.id, canEdit: e.target.checked })
                      }
                    />
                    Can add/delete properties
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
