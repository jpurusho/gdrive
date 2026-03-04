import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

class AuthService {
  private userId: number | null = null;

  constructor() {
    // Check localStorage for existing auth
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      this.userId = parseInt(storedUserId, 10);
    }
  }

  async initiateLogin(): Promise<{ authorization_url: string; state: string }> {
    const response = await axios.get(`${API_URL}/api/auth/login`);
    return response.data;
  }

  async getQrCode(): Promise<{ url: string }> {
    const response = await axios.get(`${API_URL}/api/auth/login/qr`, {
      responseType: 'blob',
    });

    const url = URL.createObjectURL(response.data);
    return { url };
  }

  async getCurrentUser(): Promise<any> {
    if (!this.userId) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${API_URL}/api/auth/user/me`, {
      params: { user_id: this.userId },
    });
    return response.data;
  }

  async refreshToken(): Promise<void> {
    if (!this.userId) {
      throw new Error('Not authenticated');
    }

    await axios.post(`${API_URL}/api/auth/refresh`, null, {
      params: { user_id: this.userId },
    });
  }

  async logout(): Promise<void> {
    if (this.userId) {
      try {
        await axios.post(`${API_URL}/api/auth/logout`, null, {
          params: { user_id: this.userId },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    this.userId = null;
    localStorage.removeItem('userId');
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.userId) {
      return false;
    }

    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      this.userId = null;
      localStorage.removeItem('userId');
      return false;
    }
  }

  setUserId(userId: number): void {
    this.userId = userId;
    localStorage.setItem('userId', userId.toString());
  }

  getUserId(): number | null {
    return this.userId;
  }
}

export const authService = new AuthService();