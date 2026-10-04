'use client';

import { useState, useTransition } from 'react';
import { Modal, ConfirmButton } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pencil, Wifi, Plus, MapPin, Check, X, Radio, Info } from 'lucide-react';
import {
  createWifi,
  updateWifi,
  deleteWifi,
  createLocation,
  type WifiInput,
  type LocationInput,
} from '@/lib/actions/crud';

type Location = { id: string; name: string; is_active: boolean };

type Wifi = {
  id: string;
  ssid: string;
  subnet: string;
  gateway: string | null;
  bssid: string | null;
  is_primary: boolean;
  is_active: boolean;
  location_id: string;
  locations: { name: string } | null;
};

export default function WifiManager({
  networks: initial,
  locations,
  canEdit,
}: {
  networks: Wifi[];
  locations: Location[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Wifi | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showLocForm, setShowLocForm] = useState(false);
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
            <Wifi className="h-5 w-5 text-primary" />
            Wi-Fi Lab
          </h2>
          <p className="apes-section-desc">
            Danh sách mạng Wi-Fi được phép điểm danh tự động
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowLocForm(true)}>
              <MapPin className="h-4 w-4" />
              Thêm cơ sở
            </Button>
            <Button variant="brand" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Thêm Wi-Fi
            </Button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {initial.length === 0 ? (
        <div className="apes-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
            <Wifi className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Chưa có Wi-Fi nào
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Thêm mạng Wi-Fi của phòng thí nghiệm để hệ thống tự động điểm danh khi
            thành viên kết nối.
          </p>
          {canEdit && (
            <Button variant="brand" className="mt-5" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Thêm Wi-Fi
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="apes-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="apes-table">
                <thead>
                  <tr>
                    <th>SSID</th>
                    <th>Subnet</th>
                    <th>Gateway</th>
                    <th>BSSID</th>
                    <th>Cơ sở</th>
                    <th className="text-center">Chính</th>
                    <th className="text-center">Trạng thái</th>
                    {canEdit && <th className="text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {initial.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              w.is_active
                                ? 'bg-success/10 text-success'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <Radio className="h-4 w-4" />
                          </div>
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {w.ssid}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {w.subnet}
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {w.gateway ?? '—'}
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">
                        {w.bssid ?? '—'}
                      </td>
                      <td>{w.locations?.name ?? '—'}</td>
                      <td className="text-center">
                        {w.is_primary ? (
                          <span className="apes-badge bg-accent text-accent-foreground">
                            Chính
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {w.is_active ? (
                          <span className="apes-badge bg-success/10 text-success">
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="apes-badge bg-muted text-muted-foreground">
                            <X className="h-3 w-3" />
                            Tắt
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td>
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditing(w);
                                setShowForm(true);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
                              aria-label={`Sửa ${w.ssid}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <ConfirmButton
                              message={`Xóa Wi-Fi "${w.ssid}"?`}
                              onConfirm={() =>
                                startTransition(async () => {
                                  await deleteWifi(w.id);
                                })
                              }
                            >
                              <span className="sr-only">Xóa {w.ssid}</span>
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
            {initial.map((w) => (
              <div key={w.id} className="apes-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        w.is_active
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Radio className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold">
                        {w.ssid}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {w.subnet}
                      </p>
                    </div>
                  </div>
                  {w.is_active ? (
                    <span className="apes-badge shrink-0 bg-success/10 text-success">
                      Active
                    </span>
                  ) : (
                    <span className="apes-badge shrink-0 bg-muted text-muted-foreground">
                      Tắt
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <p>Gateway: {w.gateway ?? '—'}</p>
                  <p>BSSID: {w.bssid ?? '—'}</p>
                  <p>Cơ sở: {w.locations?.name ?? '—'}</p>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditing(w);
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </Button>
                    <ConfirmButton
                      message={`Xóa Wi-Fi "${w.ssid}"?`}
                      onConfirm={() =>
                        startTransition(async () => {
                          await deleteWifi(w.id);
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
        </>
      )}

      {/* Wi-Fi form */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Sửa Wi-Fi' : 'Thêm Wi-Fi'}
        description={
          editing
            ? `Cập nhật cấu hình mạng ${editing.ssid}`
            : 'Khai báo mạng Wi-Fi phòng thí nghiệm'
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
            <Button type="submit" form="wifi-form" variant="brand">
              {editing ? 'Cập nhật' : 'Thêm Wi-Fi'}
            </Button>
          </>
        }
      >
        <form
          id="wifi-form"
          className="space-y-4"
          action={async (fd) => {
            const input: WifiInput = {
              location_id: String(fd.get('location_id')),
              ssid: String(fd.get('ssid')),
              subnet: String(fd.get('subnet')),
              gateway: String(fd.get('gateway') ?? '') || undefined,
              bssid: String(fd.get('bssid') ?? '') || undefined,
              is_primary: fd.get('is_primary') === 'on',
              is_active: fd.get('is_active') === 'on',
            };
            try {
              if (editing) await updateWifi(editing.id, input);
              else await createWifi(input);
              setShowForm(false);
            } catch (e: any) {
              alert(`Lỗi: ${e.message ?? e}`);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="ssid" className="apes-label">
                SSID
              </label>
              <Input
                id="ssid"
                name="ssid"
                required
                defaultValue={editing?.ssid ?? ''}
                placeholder="APES-Lab"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="location_id" className="apes-label">
                Cơ sở
              </label>
              <Select
                id="location_id"
                name="location_id"
                required
                defaultValue={editing?.location_id ?? ''}
              >
                <option value="">— Chọn —</option>
                {locations
                  .filter((l) => l.is_active)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="subnet" className="apes-label">
                Subnet (CIDR)
              </label>
              <Input
                id="subnet"
                name="subnet"
                required
                defaultValue={editing?.subnet ?? ''}
                placeholder="192.168.1.0/24"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gateway" className="apes-label">
                Gateway
              </label>
              <Input
                id="gateway"
                name="gateway"
                defaultValue={editing?.gateway ?? ''}
                placeholder="192.168.1.1"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bssid" className="apes-label">
              BSSID (MAC của AP)
            </label>
            <Input
              id="bssid"
              name="bssid"
              defaultValue={editing?.bssid ?? ''}
              placeholder="aa:bb:cc:dd:ee:ff"
              className="font-mono"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-accent/50">
              <input
                type="checkbox"
                name="is_primary"
                defaultChecked={editing?.is_primary ?? false}
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              />
              <span className="font-medium">Wi-Fi chính</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-accent/50">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editing?.is_active ?? true}
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              />
              <span className="font-medium">Đang hoạt động</span>
            </label>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Thành viên sẽ được điểm danh tự động khi kết nối vào mạng có SSID
              khớp và thuộc subnet đã khai báo.
            </span>
          </div>
        </form>
      </Modal>

      {/* Location form */}
      <Modal
        open={showLocForm}
        onClose={() => setShowLocForm(false)}
        title="Thêm cơ sở"
        description="Khai báo địa điểm phòng thí nghiệm"
        className="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLocForm(false)}
            >
              Hủy
            </Button>
            <Button type="submit" form="location-form" variant="brand">
              Thêm cơ sở
            </Button>
          </>
        }
      >
        <form
          id="location-form"
          className="space-y-4"
          action={async (fd) => {
            const input: LocationInput = {
              name: String(fd.get('name')),
              address: String(fd.get('address') ?? ''),
              is_active: fd.get('is_active') === 'on',
            };
            try {
              await createLocation(input);
              setShowLocForm(false);
            } catch (e: any) {
              alert(`Lỗi: ${e.message ?? e}`);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="loc-name" className="apes-label">
              Tên cơ sở
            </label>
            <Input
              id="loc-name"
              name="name"
              required
              placeholder="VD: Cơ sở TP.HCM"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="loc-address" className="apes-label">
              Địa chỉ
            </label>
            <Input id="loc-address" name="address" placeholder="(không bắt buộc)" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 p-3 text-sm transition-colors hover:bg-accent/50">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked
              className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            />
            <span className="font-medium">Đang hoạt động</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}