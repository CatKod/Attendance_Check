'use client';

import { useState, useTransition } from 'react';
import { Modal, ConfirmButton } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Building2, Plus, UserRound, Info } from 'lucide-react';
import {
  createGroup,
  updateGroup,
  deleteGroup,
  type GroupInput,
} from '@/lib/actions/crud';

type Member = { id: string; mssv: string; full_name: string };

type Group = {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  users: { mssv: string; full_name: string } | null;
};

export default function GroupsManager({
  groups: initial,
  members,
  canEdit,
}: {
  groups: Group[];
  members: Member[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Group | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="apes-section-title flex items-center gap-2 text-2xl">
            <Building2 className="h-5 w-5 text-primary" />
            Nhóm nghiên cứu
          </h2>
          <p className="apes-section-desc">
            {initial.length > 0
              ? `${initial.length} nhóm trong phòng thí nghiệm`
              : 'Chưa có nhóm nào'}
          </p>
        </div>
        {canEdit && (
          <Button variant="brand" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Thêm nhóm
          </Button>
        )}
      </div>

      {/* Empty state */}
      {initial.length === 0 ? (
        <div className="apes-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Chưa có nhóm nào
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Tạo nhóm để phân chia thành viên và chỉ định trưởng nhóm.
          </p>
          {canEdit && (
            <Button variant="brand" className="mt-5" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Thêm nhóm
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {initial.map((g) => (
            <div key={g.id} className="apes-card group p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-brand-gradient group-hover:text-white">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h3 className="truncate text-base font-semibold text-foreground">
                    {g.name}
                  </h3>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditing(g);
                        setShowForm(true);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
                      aria-label={`Sửa ${g.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <ConfirmButton
                      message={`Xóa nhóm "${g.name}"?`}
                      onConfirm={() =>
                        startTransition(async () => {
                          await deleteGroup(g.id);
                        })
                      }
                    >
                      <span className="sr-only">Xóa {g.name}</span>
                    </ConfirmButton>
                  </div>
                )}
              </div>

              {g.description && (
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
                  {g.description}
                </p>
              )}
              {!g.description && <div className="mt-3 min-h-[2.5rem]" />}

              <div className="mt-4 flex items-center gap-2.5 border-t border-border/60 pt-3.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Trưởng nhóm
                  </p>
                  {g.users ? (
                    <p className="truncate text-sm font-medium text-foreground">
                      {g.users.full_name}{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        {g.users.mssv}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      Chưa chỉ định
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Sửa nhóm' : 'Thêm nhóm'}
        description={
          editing
            ? `Cập nhật thông tin nhóm ${editing.name}`
            : 'Tạo nhóm nghiên cứu mới'
        }
        className="max-w-xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Hủy
            </Button>
            <Button type="submit" form="group-form" variant="brand">
              {editing ? 'Cập nhật' : 'Thêm nhóm'}
            </Button>
          </>
        }
      >
        <form
          id="group-form"
          className="space-y-4"
          action={async (fd) => {
            const input: GroupInput = {
              name: String(fd.get('name')),
              description: String(fd.get('description') ?? ''),
              leader_id: fd.get('leader_id') ? String(fd.get('leader_id')) : null,
            };
            try {
              if (editing) await updateGroup(editing.id, input);
              else await createGroup(input);
              setShowForm(false);
            } catch (e: any) {
              alert(`Lỗi: ${e.message ?? e}`);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="name" className="apes-label">
              Tên nhóm
            </label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={editing?.name ?? ''}
              placeholder="VD: Nhóm Mô hình 5G"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="apes-label">
              Mô tả
            </label>
            <Textarea
              id="description"
              name="description"
              defaultValue={editing?.description ?? ''}
              placeholder="(không bắt buộc)"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="leader_id" className="apes-label">
              Trưởng nhóm
            </label>
            <Select
              id="leader_id"
              name="leader_id"
              defaultValue={editing?.leader_id ?? ''}
            >
              <option value="">— Chưa chỉ định —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.mssv})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Trưởng nhóm sẽ nhận được quyền xem báo cáo của nhóm tương ứng.
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}