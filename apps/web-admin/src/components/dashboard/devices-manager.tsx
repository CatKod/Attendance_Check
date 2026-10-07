'use client';

import { useState, useTransition, useMemo } from 'react';
import { Modal, ConfirmButton } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smartphone, Laptop, RotateCcw, Search, Monitor } from 'lucide-react';
import {
  getMemberDevices,
  resetDeviceBinding,
  type DeviceBinding,
} from '@/lib/actions/devices';

type Group = { id: string; name: string };

type Member = {
  id: string;
  mssv: string;
  full_name: string;
  role: string;
  group_name: string | null;
  has_desktop: boolean;
  has_mobile: boolean;
  desktop_mac: string | null;
  desktop_hostname: string | null;
  desktop_bound_at: string | null;
  mobile_bound_at: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  student: 'SV',
  group_leader: 'Trưởng nhóm',
  lab_leader: 'Trưởng Lab',
  lab_manager: 'QL Lab',
};

export default function DevicesManager({
  members,
  canEdit,
}: {
  members: Member[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);
  const [devices, setDevices] = useState<DeviceBinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState<DeviceBinding | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [filter, setFilter] = useState<'all' | 'desktop' | 'mobile' | 'none'>(
    'all'
  );
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = members;
    if (q) {
      list = list.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.mssv.toLowerCase().includes(q) ||
          (m.desktop_mac ?? '').toLowerCase().includes(q)
      );
    }
    if (filter === 'desktop') list = list.filter((m) => m.has_desktop);
    else if (filter === 'mobile') list = list.filter((m) => m.has_mobile);
    else if (filter === 'none') list = list.filter((m) => !m.has_desktop && !m.has_mobile);
    return list;
  }, [members, query, filter]);

  const openDetail = async (m: Member) => {
    setSelected(m);
    setLoading(true);
    try {
      const d = await getMemberDevices(m.id);
      setDevices(d);
    } catch (e: any) {
      alert(`Lỗi: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDevices([]);
  };

  const doReset = () => {
    if (!resetting) return;
    if (resetReason.trim().length < 3) {
      alert('Vui lòng nhập lý do (tối thiểu 3 ký tự)');
      return;
    }
    startTransition(async () => {
      try {
        await resetDeviceBinding(resetting.binding_id, resetReason);
        // Reload
        if (selected) await openDetail(selected);
        setResetting(null);
        setResetReason('');
        alert('Đã reset binding. Sinh viên có thể đăng nhập lại trên máy mới.');
      } catch (e: any) {
        alert(`Lỗi: ${e.message ?? e}`);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="apes-section-title flex items-center gap-2 text-2xl">
          <Monitor className="h-5 w-5 text-primary" />
          Quản lý thiết bị
        </h2>
        <p className="apes-section-desc">
          Reset binding khi sinh viên đổi máy hoặc mất máy
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, MSSV, MAC..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border/60 bg-card p-1">
          {(['all', 'desktop', 'mobile', 'none'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {f === 'all' && 'Tất cả'}
              {f === 'desktop' && 'Có máy'}
              {f === 'mobile' && 'Có ĐT'}
              {f === 'none' && 'Chưa liên kết'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="apes-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="apes-table">
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>MSSV</th>
                <th>Nhóm</th>
                <th className="text-center">Máy tính</th>
                <th className="text-center">Điện thoại</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <p className="font-semibold text-foreground">{m.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </p>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {m.mssv}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {m.group_name ?? '—'}
                  </td>
                  <td className="text-center">
                    {m.has_desktop ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Laptop className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    {m.has_mobile ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Smartphone className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDetail(m)}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((m) => (
          <div
            key={m.id}
            className="apes-card flex items-center gap-3 p-4"
            onClick={() => openDetail(m)}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {m.full_name}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {m.mssv}
              </p>
            </div>
            <div className="flex gap-1.5">
              {m.has_desktop && (
                <Laptop className="h-4 w-4 text-emerald-600" />
              )}
              {m.has_mobile && (
                <Smartphone className="h-4 w-4 text-blue-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal chi tiết */}
      <Modal
        open={!!selected}
        onClose={closeDetail}
        title={selected ? `Thiết bị của ${selected.full_name}` : ''}
        description={selected ? `MSSV: ${selected.mssv}` : ''}
        className="max-w-2xl"
        footer={
          <Button variant="outline" onClick={closeDetail}>
            Đóng
          </Button>
        }
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Đang tải…
          </p>
        ) : devices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chưa có thiết bị nào được liên kết
          </p>
        ) : (
          <div className="space-y-3">
            {devices.map((d) => (
              <div
                key={d.binding_id}
                className={`rounded-xl border p-4 ${
                  d.status === 'active'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-slate-200 bg-slate-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {d.kind === 'desktop' ? (
                      <Laptop className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Smartphone className="h-5 w-5 text-blue-600" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">
                        {d.kind === 'desktop' ? 'Máy tính' : 'Điện thoại'}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {d.device_identifier}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`apes-badge ${
                      d.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {d.status === 'active' ? 'Active' : 'Reset'}
                  </span>
                </div>

                <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  {d.hostname && (
                    <p>
                      <span className="font-semibold">Hostname:</span> {d.hostname}
                    </p>
                  )}
                  {d.os_info && (
                    <p>
                      <span className="font-semibold">OS:</span> {d.os_info}
                    </p>
                  )}
                  {d.disk_serial && (
                    <p className="font-mono">
                      <span className="font-semibold">Disk serial:</span>{' '}
                      {d.disk_serial}
                    </p>
                  )}
                  {d.note && (
                    <p>
                      <span className="font-semibold">Ghi chú:</span> {d.note}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold">Liên kết:</span>{' '}
                    {new Date(d.bound_at).toLocaleString('vi-VN')}
                  </p>
                  {d.last_seen_at && (
                    <p>
                      <span className="font-semibold">Online cuối:</span>{' '}
                      {new Date(d.last_seen_at).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {d.mobile_linked_at && (
                    <p>
                      <span className="font-semibold">Đã liên kết mobile:</span>{' '}
                      {new Date(d.mobile_linked_at).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>

                {canEdit && d.status === 'active' && (
                  <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
                    <ConfirmButton
                      message={`Reset binding ${
                        d.kind === 'desktop' ? 'máy tính' : 'điện thoại'
                      }? SV sẽ phải đăng nhập lại.`}
                      onConfirm={() => setResetting(d)}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </ConfirmButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal xác nhận reset */}
      <Modal
        open={!!resetting}
        onClose={() => {
          setResetting(null);
          setResetReason('');
        }}
        title="Reset binding thiết bị"
        description="Sinh viên sẽ cần đăng nhập lại trên máy/điện thoại khác"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setResetting(null);
                setResetReason('');
              }}
            >
              Huỷ
            </Button>
            <Button
              variant="brand"
              onClick={doReset}
              disabled={resetReason.trim().length < 3}
            >
              Xác nhận reset
            </Button>
          </>
        }
      >
        {resetting && (
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Bạn sắp reset binding <span className="font-semibold">
                {resetting.kind === 'desktop' ? 'máy tính' : 'điện thoại'}
              </span>{' '}
              với MAC/ID <span className="font-mono">{resetting.device_identifier}</span>.
            </div>
            <div className="space-y-1.5">
              <label className="apes-label">Lý do reset</label>
              <Input
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="VD: SV báo mất laptop, yêu cầu đổi máy"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Lý do sẽ được lưu vào audit log
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
