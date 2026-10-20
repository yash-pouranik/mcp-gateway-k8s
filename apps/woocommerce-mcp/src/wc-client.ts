export interface WooCommerceConfig {
  baseUrl: string;
  hostHeader: string;
  consumerKey: string;
  consumerSecret: string;
}

export class WooCommerceClient {
  private config: WooCommerceConfig;
  private authHeader: string;

  constructor(config?: Partial<WooCommerceConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || process.env.WOOCOMMERCE_API_URL || 'http://wordpress.woocommerce.svc.cluster.local:80',
      hostHeader: config?.hostHeader || process.env.WOOCOMMERCE_HOST_HEADER || 'store.localtest.me',
      consumerKey: config?.consumerKey || process.env.WOOCOMMERCE_CONSUMER_KEY || 'ck_urumi_mcp_gateway_prod_key',
      consumerSecret: config?.consumerSecret || process.env.WOOCOMMERCE_CONSUMER_SECRET || 'cs_urumi_mcp_gateway_prod_secret'
    };

    const token = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
    this.authHeader = `Basic ${token}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}/wp-json/wc/v3${endpoint}`;
    const headers: Record<string, string> = {
      'Host': this.config.hostHeader,
      'Authorization': this.authHeader,
      'X-Forwarded-Proto': 'https',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = `WooCommerce API Error (${res.status} ${res.statusText})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = `${errorMessage}: ${errorJson.message}`;
        }
      } catch {
        errorMessage = `${errorMessage}: ${errorText.slice(0, 200)}`;
      }
      throw new Error(errorMessage);
    }

    return (await res.json()) as T;
  }

  // 1. List Products
  async listProducts(params?: { per_page?: number; search?: string; status?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.per_page) query.set('per_page', params.per_page.toString());
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/products${qs}`);
  }

  // 2. Create Product
  async createProduct(data: Record<string, any>): Promise<any> {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify({
        type: data.type || 'simple',
        status: data.status || 'publish',
        ...data
      })
    });
  }

  // 3. List Orders
  async listOrders(params?: { per_page?: number; status?: string; after?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.per_page) query.set('per_page', params.per_page.toString());
    if (params?.status) query.set('status', params.status);
    if (params?.after) query.set('after', params.after);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/orders${qs}`);
  }

  // 4. Get Order
  async getOrder(orderId: number | string): Promise<any> {
    return this.request<any>(`/orders/${orderId}`);
  }

  // 5. Update Order Status
  async updateOrderStatus(orderId: number | string, status: string): Promise<any> {
    return this.request<any>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // 6. Get Product by ID
  async getProduct(productId: number | string): Promise<any> {
    return this.request<any>(`/products/${productId}`);
  }

  // 7. Update Product
  async updateProduct(productId: number | string, data: Record<string, any>): Promise<any> {
    return this.request<any>(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // 8. Delete Product
  async deleteProduct(productId: number | string, force = true): Promise<any> {
    return this.request<any>(`/products/${productId}?force=${force}`, {
      method: 'DELETE'
    });
  }

  // 9. List Customers
  async listCustomers(params?: { per_page?: number; role?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.per_page) query.set('per_page', params.per_page.toString());
    if (params?.role) query.set('role', params.role);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/customers${qs}`);
  }

  // 10. List Product Categories
  async listCategories(): Promise<any[]> {
    return this.request<any[]>('/products/categories?per_page=50');
  }

  // 11. Create Product Category
  async createCategory(data: { name: string; description?: string; slug?: string }): Promise<any> {
    return this.request<any>('/products/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 12. List Product Tags
  async listTags(): Promise<any[]> {
    return this.request<any[]>('/products/tags?per_page=50');
  }
}

