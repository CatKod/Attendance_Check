'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không đúng.'
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Đăng nhập
        </h2>
        <p className="text-sm text-muted-foreground">
          Nhập thông tin tài khoản quản trị của bạn
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="apes-label">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="lab.leader@apes.edu.vn"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="apes-label">
          Mật khẩu
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/8 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang đăng nhập...
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Đăng nhập
          </>
        )}
      </Button>
    </form>
  );
}