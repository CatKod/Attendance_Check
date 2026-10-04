'use client';

import { useMemo, useState, useTransition } from 'react';
import { Modal, ConfirmButton } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Plus, Pencil, Users, Search, UserPlus, KeyRound } from 'lucide-react';
import {
  createMember,
  updateMember,
  deleteMember,
  type MemberInput,
} from '@/lib/actions/crud';

type Group = { id: string; name: string };

type Member = {
  id: string;
  mssv: string;
  full_name: string;
  email: string;
  khoa: string;
  group_id: string | null;
  role: 'student' | 'group_leader' | 'lab_leader' | 'lab_manager';
  groups: { name: string } | null;
};

const ROLE_LABELS: Record<string, string> = {
  student: 'Sinh viên',
  group_leader: 'Trưởng nhóm',
  lab_leader: 'Trưởng Lab',
  lab_manager: 'Quản lý Lab',
};

const ROLE_BADGE: Record<string, string> = {
  lab_manager: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  lab_leader: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  group_leader: 'bg-success/10 text-success ring-success/20',
  student: 'bg-muted text-muted-foreground ring-border',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MembersManager({
  members: initial,
  groups,
  canEdit,
}: {
  members: Member[];
  groups: Group[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.mssv.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.groups?.name ?? '').toLowerCase().includes(q)
    );
  }, [initial, query]);

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (u: Member) => {
    setEditing(u);
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="apes-section-title flex items-center gap-2 text-2xl">
            <Users className="h-5 w-5 text-primary" />
            Thành viên
          </h2>
          <p className="apes-section-desc">
            {initial.length > 0
              ? `Quản lý ${initial.length} thành viên trong hệ thống`
              : 'Chưa có thành viên nào'}
          </p>
        </div>
        {canEdit && (
          <Button variant="brand" onClick={openAdd}>
            <UserPlus className="h-4 w-4" />
            Thêm thành viên
          </Button>
        )}
      </div>

      {/* Search */}
      {initial.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, MSSV, email..."
            className="pl-9"
            aria-label="Tìm thành viên"
          />
        </div>
      )}

      {/* Empty state */}
      {initial.length === 0 ? (
        <div className="apes-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Chưa có thành viên
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Thêm thành viên đầu tiên để bắt đầu quản lý điểm danh.
          </p>
          {canEdit && (
            <Button variant="brand" className="mt-5" onClick={openAdd}>
              <UserPlus className="h-4 w-4" />
              Thêm thành viên
            </Button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="apes-card px-6 py-14 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Không tìm thấy kết quả
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thử tìm với từ khóa khác
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="apes-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="apes-table">
                <thead>
                  <tr>
                    <th>Thành viên</th>
                    <th>MSSV</th>
                    <th>Email</th>
                    <th>Khóa</th>
                    <th>Nhóm</th>
                    <th>Vai trò</th>
                    {canEdit && <th className="text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                            {initials(u.full_name)}
                          </div>
                          <span className="font-semibold text-foreground">
                            {u.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {u.mssv}
                      </td>
                      <td className="text-muted-foreground">{u.email ?? '—'}</td>
                      <td>{u.khoa}</td>
                      <td>{u.groups?.name ?? '—'}</td>
                      <td>
                        <span
                          className={`apes-badge ring-1 ring-inset ${ROLE_BADGE[u.role] ?? ROLE_BADGE.student}`}
                        >
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(u)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
                              aria-label={`Sửa ${u.full_name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <ConfirmButton
                              message={`Xóa thành viên ${u.full_name}?`}
                              onConfirm={() =>
                                startTransition(async () => {
                                  await deleteMember(u.id);
                                })
                              }
                            >
                              <span className="sr-only">Xóa {u.full_name}</span>
                            </ConfirmButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((u) => (
              <div key={u.id} className="apes-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {initials(u.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {u.full_name}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {u.mssv}
                    </p>
                  </div>
                  <span
                    className={`apes-badge shrink-0 ring-1 ring-inset ${ROLE_BADGE[u.role] ?? ROLE_BADGE.student}`}
                  >
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </div>
                <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <p className="truncate">{u.email}</p>
                  <p>
                    Khóa {u.khoa}
                    {u.groups?.name ? ` · ${u.groups.name}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(u)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </Button>
                    <ConfirmButton
                      message={`Xóa thành viên ${u.full_name}?`}
                      onConfirm={() =>
                        startTransition(async () => {
                          await deleteMember(u.id);
                        })
                      }
                      className="flex-1 justify-center"
                    >
                      Xóa
                    </ConfirmButton>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filtered.length !== initial.length && (
            <p className="text-center text-xs text-muted-foreground">
              Hiển thị {filtered.length}/{initial.length} thành viên
            </p>
          )}
        </>
      )}

      {/* Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Sửa thành viên' : 'Thêm thành viên'}
        description={
          editing
            ? `Cập nhật thông tin của ${editing.full_name}`
            : 'Điền thông tin thành viên mới của APES Lab'
        }
        className="max-w-2xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Hủy
            </Button>
            <Button type="submit" form="member-form" variant="brand">
              {editing ? 'Cập nhật' : 'Thêm thành viên'}
            </Button>
          </>
        }
      >
        <form
          id="member-form"
          className="space-y-4"
          action={async (fd) => {
            const input: MemberInput = {
              mssv: String(fd.get('mssv')),
              full_name: String(fd.get('full_name')),
              email: String(fd.get('email')),
              khoa: String(fd.get('khoa')),
              group_id: fd.get('group_id') ? String(fd.get('group_id')) : null,
              role: String(fd.get('role')) as MemberInput['role'],
            };
            try {
              if (editing) await updateMember(editing.id, input);
              else await createMember(input);
              setShowForm(false);
            } catch (e: any) {
              alert(`Lỗi: ${e.message ?? e}`);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="mssv" className="apes-label">
                MSSV
              </label>
              <Input
                id="mssv"
                name="mssv"
                required
                defaultValue={editing?.mssv ?? ''}
                disabled={!!editing}
                placeholder="20232276"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="full_name" className="apes-label">
                Họ tên
              </label>
              <Input
                id="full_name"
                name="full_name"
                required
                defaultValue={editing?.full_name ?? ''}
                placeholder="Nguyễn Văn A"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="apes-label">
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email"
              required
              defaultValue={editing?.email ?? ''}
              placeholder="20232276@apes.edu.vn"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="khoa" className="apes-label">
                Khóa
              </label>
              <Input
                id="khoa"
                name="khoa"
                required
                defaultValue={editing?.khoa ?? 'K68'}
                placeholder="K68"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="group_id" className="apes-label">
                Nhóm
              </label>
              <Select id="group_id" name="group_id" defaultValue={editing?.group_id ?? ''}>
                <option value="">— Chưa có —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="role" className="apes-label">
              Vai trò
            </label>
            <Select id="role" name="role" defaultValue={editing?.role ?? 'student'}>
              <option value="student">Sinh viên</option>
              <option value="group_leader">Trưởng nhóm</option>
              <option value="lab_leader">Trưởng Lab</option>
              <option value="lab_manager">Quản lý Lab</option>
            </Select>
          </div>

          {!editing && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/8 p-3 text-xs text-foreground">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                Mật khẩu mặc định sẽ là{' '}
                <span className="font-semibold">MSSV</span> — nên đổi sau lần đăng
                nhập đầu tiên.
              </span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}