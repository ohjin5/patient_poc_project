const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";

export async function login(accessCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accessCode }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "접근코드가 올바르지 않습니다." };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: "서버 연결에 실패했습니다." };
  }
}

export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/session`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.authenticated);
  } catch (err) {
    return false;
  }
}

export async function logout(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}
