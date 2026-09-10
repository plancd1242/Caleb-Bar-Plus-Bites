import { weatherResponse, type WeatherEnv } from './weather';
import { DurableObject } from 'cloudflare:workers';
import { currentMenu, defaultSettings } from '../src/lib/menu';
import { quote } from '../src/lib/pricing';
import {
  statuses,
  type CartLine,
  type Order,
  type Promotion,
  type Settings,
} from '../src/lib/types';
type Secrets = { EMPLOYEE_CODE?: string; GIPHY_API_KEY?: string };
type Session = { id: string; employee: boolean; expires: number };
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
export class Restaurant extends DurableObject<Env & Secrets> {
  constructor(ctx: DurableObjectState, env: Env & Secrets) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
  }
  get<T>(key: string): T | undefined {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>('SELECT value FROM records WHERE key = ?', key)
      .toArray()[0];
    return row ? JSON.parse(row.value) : undefined;
  }
  put(key: string, value: unknown) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO records VALUES (?,?)',
      key,
      JSON.stringify(value),
    );
  }
  remove(key: string) {
    this.ctx.storage.sql.exec('DELETE FROM records WHERE key = ?', key);
  }
  settings() {
    return this.get<Settings>('settings') ?? structuredClone(defaultSettings);
  }
  session(request: Request) {
    const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)barn_session=([^;]+)/)?.[1];
    const session = token ? this.get<Session>('session:' + token) : undefined;
    return session && session.expires > Date.now() ? session : undefined;
  }
  emit() {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(JSON.stringify({ type: 'refresh' }));
      } catch {
        socket.close();
      }
    }
  }
  limited(key: string, max: number, windowMs: number) {
    const now = Date.now();
    let value = this.get<{ count: number; until: number }>('rate:' + key);
    if (!value || value.until < now) value = { count: 0, until: now + windowMs };
    value.count++;
    this.put('rate:' + key, value);
    return value.count > max;
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url),
        path = url.pathname,
        method = request.method;
      if (method !== 'GET' && request.headers.get('Origin') !== url.origin)
        return json({ error: 'Untrusted request origin.' }, 403);
      if (method !== 'GET' && !request.headers.get('Content-Type')?.includes('application/json'))
        return json({ error: 'JSON required.' }, 415);
      const session = this.session(request);
      const read = async () => {
        const reader = request.body?.getReader();
        if (!reader) throw new Error('Request body required.');
        let size = 0;
        let text = '';
        const decoder = new TextDecoder();
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 24000) {
            await reader.cancel();
            throw new Error('Request is too large.');
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
        const value = JSON.parse(text);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('JSON object required.');
        return value;
      };
      if (path === '/api/session' && method === 'GET') {
        if (session) return json({ employee: session.employee });
        const token = crypto.randomUUID(),
          created = {
            id: crypto.randomUUID(),
            employee: false,
            expires: Date.now() + 12 * 3600000,
          };
        this.put('session:' + token, created);
        return json({ employee: false }, 200, {
          'Set-Cookie': `barn_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${url.protocol === 'https:' ? '; Secure' : ''}`,
        });
      }
      if (path === '/api/menu' && method === 'GET') {
        const settings = this.settings();
        return json({ menu: currentMenu(settings), settings });
      }
      if (!session)
        return json(
          { error: 'Your session expired. Reload to reconnect; your cart is saved.' },
          401,
        );
      if (path === '/api/events' && method === 'GET') {
        if (request.headers.get('Upgrade') !== 'websocket')
          return json({ error: 'WebSocket required.' }, 426);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1]);
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      if (path === '/api/auth' && method === 'POST') {
        if (!this.env.EMPLOYEE_CODE)
          return json(
            { error: 'Employee access is not configured. Set the server EMPLOYEE_CODE secret.' },
            503,
          );
        if (this.limited('auth:' + (request.headers.get('CF-Connecting-IP') ?? 'local'), 8, 300000))
          return json({ error: 'Too many attempts. Please wait five minutes.' }, 429);
        const { code } = await read();
        if (typeof code !== 'string' || !code)
          return json({ error: 'Enter your authorization code.' }, 400);
        const encode = new TextEncoder();
        const [a, b] = await Promise.all([
          crypto.subtle.digest('SHA-256', encode.encode(code)),
          crypto.subtle.digest('SHA-256', encode.encode(this.env.EMPLOYEE_CODE)),
        ]);
        if (!crypto.subtle.timingSafeEqual(a, b))
          return json({ error: 'That code isn’t correct. Try again.' }, 401);
        const old = request.headers.get('Cookie')!.match(/barn_session=([^;]+)/)![1];
        this.remove('session:' + old);
        const token = crypto.randomUUID();
        this.put('session:' + token, {
          ...session,
          employee: true,
          expires: Date.now() + 8 * 3600000,
        });
        return json({ employee: true }, 200, {
          'Set-Cookie': `barn_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${url.protocol === 'https:' ? '; Secure' : ''}`,
        });
      }
      if (path === '/api/logout' && method === 'POST') {
        const token = request.headers.get('Cookie')!.match(/barn_session=([^;]+)/)![1];
        this.put('session:' + token, { ...session, employee: false });
        return json({ ok: true });
      }
      if (path === '/api/quote' && method === 'POST') {
        const body = await read();
        const s = this.settings();
        return json(
          quote(body.cart, currentMenu(s), s.promotions ? body.promotion : 'none', s.revision),
        );
      }
      if (path === '/api/recover' && method === 'POST') {
        const body = await read();
        if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.requestId))
          throw new Error('Invalid order request.');
        const id = this.get<string>('request:' + body.requestId);
        if (!id) return json({ order: null });
        const order = this.get<Order>('order:' + id)!;
        if (order.customer !== session.id)
          return json(
            {
              error:
                'An earlier session already sent this order. Please ask an employee to check it before ordering again.',
            },
            409,
          );
        return json({ order });
      }
      if (path === '/api/orders' && method === 'POST') {
        const body = await read();
        if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.requestId))
          throw new Error('Invalid order request.');
        const key = 'request:' + body.requestId,
          existing = this.get<string>(key);
        if (existing) {
          const received = this.get<Order>('order:' + existing)!;
          if (received.customer !== session.id)
            return json(
              {
                error:
                  'An earlier session already sent this order. Please ask an employee to check it before ordering again.',
              },
              409,
            );
          return json(received);
        }
        const settings = this.settings();
        if (!settings.open)
          return json({ error: 'We’re closed right now. Your cart is saved for later.' }, 409);
        if (this.limited('order:' + session.id, 12, 60000))
          return json({ error: 'Please wait a minute before sending another order.' }, 429);
        if (
          typeof body.name !== 'string' ||
          body.name.trim().length < 2 ||
          body.name.trim().length > 60
        )
          throw new Error('Please enter a name between 2 and 60 characters.');
        const priced = quote(
          body.cart as CartLine[],
          currentMenu(settings),
          settings.promotions ? (body.promotion as Promotion) : 'none',
          settings.revision,
        );
        if (!priced.lines.length)
          throw new Error('Your basket is empty. Add something delicious first.');
        if (body.revision !== settings.revision || body.total !== priced.total)
          return json(
            { error: 'Menu prices or specials changed. Review the updated total before sending.' },
            409,
          );
        let order!: Order;
        this.ctx.storage.transactionSync(() => {
          const count = (this.get<number>('counter') ?? 0) + 1;
          this.put('counter', count);
          const id = 'BARN-' + String(count).padStart(3, '0');
          order = {
            ...priced,
            id,
            name: body.name.trim(),
            customer: session.id,
            requestId: body.requestId,
            createdAt: Date.now(),
            status: 'NEW',
          };
          this.put('order:' + id, order);
          this.put(key, id);
        });
        this.emit();
        return json(order, 201);
      }
      if (path === '/api/orders' && method === 'GET') {
        const orders = this.ctx.storage.sql
          .exec<{ value: string }>("SELECT value FROM records WHERE key LIKE 'order:%'")
          .toArray()
          .map((r) => JSON.parse(r.value) as Order)
          .filter((o) => session.employee || o.customer === session.id)
          .sort((a, b) => b.createdAt - a.createdAt);
        return json(orders.map(({ customer, ...order }) => order));
      }
      if (path === '/api/celebration' && method === 'GET') {
        if (!this.env.GIPHY_API_KEY) return json({ url: null });
        try {
          const result = await fetch(
            `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(this.env.GIPHY_API_KEY)}&q=happy+food&rating=g&limit=1`,
            { signal: AbortSignal.timeout(3000) },
          );
          const data = (await result.json()) as {
            data?: { images?: { fixed_height?: { url?: string } } }[];
          };
          const gif = data.data?.[0]?.images?.fixed_height?.url;
          return json({ url: gif?.startsWith('https://') ? gif : null });
        } catch {
          return json({ url: null });
        }
      }
      if (!session.employee) return json({ error: 'Employee authorization required.' }, 401);
      if (path === '/api/settings' && method === 'POST') {
        const body = await read(),
          s = this.settings();
        if (typeof body.open === 'boolean') s.open = body.open;
        if (typeof body.promotions === 'boolean') s.promotions = body.promotions;
        if (body.item) {
          const item = currentMenu(s).find((i) => i.id === body.item.id);
          if (!item) throw new Error('Unknown menu item.');
          const change: { price?: number; available?: boolean } = { ...s.overrides[item.id] };
          if (typeof body.item.available === 'boolean') change.available = body.item.available;
          if (body.item.price !== undefined) {
            if (item.price === null)
              throw new Error('Custom requests require individual employee quotes.');
            if (
              !Number.isInteger(body.item.price) ||
              body.item.price < 50 ||
              body.item.price > 100000
            )
              throw new Error('Price must be between $0.50 and $1,000.00.');
            change.price = body.item.price;
          }
          s.overrides[item.id] = change;
        }
        s.revision++;
        this.put('settings', s);
        this.emit();
        return json(s);
      }
      if (path.startsWith('/api/orders/') && method === 'PATCH') {
        const id = decodeURIComponent(path.split('/').pop()!),
          order = this.get<Order>('order:' + id);
        if (!order) return json({ error: 'Order not found.' }, 404);
        const body = await read();
        if (body.customPrices) {
          if (order.status === 'COMPLETED') throw new Error('Completed orders cannot be changed.');
          for (const [index, price] of Object.entries(body.customPrices)) {
            const line = order.lines[Number(index)];
            if (
              !line ||
              line.price !== null ||
              !Number.isInteger(price) ||
              Number(price) < 0 ||
              Number(price) > 100000
            )
              throw new Error('Invalid custom price.');
            line.price = Number(price);
          }
          order.subtotal = order.lines.reduce((s, l) => s + (l.price ?? 0) * l.quantity, 0);
          order.total = order.subtotal - order.discount;
          order.pending = order.lines.some((l) => l.price === null);
        }
        if (body.status) {
          if (statuses.indexOf(body.status) !== statuses.indexOf(order.status) + 1)
            throw new Error('Advance orders one step at a time.');
          if (order.pending) throw new Error('Confirm custom prices before advancing this order.');
          order.status = body.status;
        }
        this.put('order:' + id, order);
        this.emit();
        return json(order);
      }
      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'Could not complete this request.' },
        400,
      );
    }
  }
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') socket.send('pong');
  }
  webSocketClose(socket: WebSocket, code: number) {
    socket.close(code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000);
  }
}
export default {
  async fetch(request: Request, env: Env & Secrets & WeatherEnv): Promise<Response> {
    if (new URL(request.url).pathname === '/api/weather') return weatherResponse(request, env);
    if (new URL(request.url).pathname.startsWith('/api/')) {
      // Consume the bounded body before forwarding. Early authorization rejections
      // must not leave an in-flight request stream crossing a Durable Object boundary.
      if (request.body) {
        const reader = request.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 24000) {
            await reader.cancel();
            return json({ error: 'Request is too large.' }, 413);
          }
          chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        request = new Request(request, { body: bytes });
      }
      return env.RESTAURANT.getByName(env.RESTAURANT_ID).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env & Secrets & WeatherEnv>;
