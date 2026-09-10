<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { money } from '$lib/pricing';
  import { statuses, type Order, type MenuItem, type Settings } from '$lib/types';
  import Icon from './Icon.svelte';
  export let authorized = false;
  export let menu: MenuItem[];
  export let settings: Settings;
  export let refresh: () => Promise<void>;
  export let onAuth: (value: boolean) => void;
  let code = '';
  let error = '';
  let busy = false;
  let tab = 'Live Orders';
  let orders: Order[] = [];
  let priceValues: Record<string, string> = {};
  let customValues: Record<string, string> = {};
  let station = 'Customer iPad';
  let large = false;
  let wake = false;
  const tabs = [
    'Live Orders',
    'Order History',
    'Menu Manager',
    'Price Manager',
    'Restaurant Open / Closed',
    'Station Management',
    'Display Settings',
    'System Settings',
  ];
  onMount(() => {
    station = localStorage.getItem('barn-station') ?? 'Customer iPad';
    large = localStorage.getItem('barn-large') === 'true';
    wake = localStorage.getItem('barn-wake') === 'true';
    const listener = () => {
      if (authorized) void load();
    };
    window.addEventListener('barn-refresh', listener);
    if (authorized) void load();
    return () => window.removeEventListener('barn-refresh', listener);
  });
  async function load() {
    try {
      orders = await api<Order[]>('/orders');
    } catch (e) {
      error = String(e);
    }
  }
  async function login() {
    busy = true;
    error = '';
    try {
      await api('/auth', { code });
      code = '';
      onAuth(true);
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to sign in.';
    } finally {
      busy = false;
    }
  }
  async function logout() {
    try {
      await api('/logout', {});
      onAuth(false);
      orders = [];
    } catch {
      error = 'Couldn’t relock. Reconnect and try again.';
    }
  }
  async function setting(body: unknown) {
    error = '';
    busy = true;
    try {
      await api('/settings', body);
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Couldn’t save.';
    } finally {
      busy = false;
    }
  }
  function cents(value: string) {
    if (!/^\d+(\.\d{1,2})?$/.test(value))
      throw new Error('Enter a dollar amount with up to two decimal places.');
    const [d, c = ''] = value.split('.');
    return Number(d) * 100 + Number(c.padEnd(2, '0'));
  }
  async function savePrice(item: MenuItem) {
    try {
      await setting({
        item: {
          id: item.id,
          price: cents(priceValues[item.id] ?? ((item.price ?? 0) / 100).toFixed(2)),
        },
      });
    } catch (e) {
      error = String(e);
    }
  }
  async function update(order: Order, body: unknown) {
    busy = true;
    error = '';
    try {
      await api('/orders/' + order.id, body, 'PATCH');
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Couldn’t update order.';
    } finally {
      busy = false;
    }
  }
  async function customPrice(order: Order, index: number) {
    try {
      await update(order, {
        customPrices: { [index]: cents(customValues[order.id + index] ?? '') },
      });
    } catch (e) {
      error = String(e);
    }
  }
  function saveDisplay() {
    localStorage.setItem('barn-large', String(large));
    document.documentElement.classList.toggle('large-type', large);
  }
  function saveWake() {
    localStorage.setItem('barn-wake', String(wake));
    window.dispatchEvent(new Event('barn-wake'));
  }
</script>

{#if !authorized}<div class="auth-container">
    <div class="auth-emblem"><Icon name="lock" size={34} /></div>
    <p class="eyebrow">FOR THE PEOPLE BEHIND THE GOOD FOOD</p>
    <h1>Employee access</h1>
    <p>Enter your authorization code to open the control center.</p>
    <form
      class="auth-form"
      onsubmit={(event) => {
        event.preventDefault();
        void login();
      }}
    >
      <label for="auth-code">Enter authorization code</label><input
        id="auth-code"
        type="password"
        inputmode="numeric"
        autocomplete="off"
        maxlength="100"
        bind:value={code}
        placeholder="• • • •"
      />{#if error}<div role="alert" class="notice error">{error}</div>{/if}<button
        class="primary wide"
        disabled={busy || !code}
        >{busy ? 'Checking…' : 'Unlock control center'} <Icon name="arrow" /></button
      >
    </form>
    <p class="fine-print">Authorized employees only. Your session locks after 8 hours.</p>
  </div>
{:else}<div class="page-heading">
    <div>
      <p class="eyebrow">A LITTLE BEHIND-THE-SCENES MAGIC</p>
      <h1>Employee control center</h1>
      <p>Keep the good food and good times flowing.</p>
    </div>
    <button class="secondary" onclick={logout}><Icon name="lock" /> Relock</button>
  </div>
  <div class="employee-tabs">
    {#each tabs as t}<button
        class:active={tab === t}
        onclick={() => {
          tab = t;
          if (t.includes('Orders') || t.includes('History')) void load();
        }}>{t}</button
      >{/each}
  </div>
  {#if error}<div class="notice error" role="alert">{error}</div>{/if}
  {#if tab === 'Live Orders' || tab === 'Order History'}{@const shown = orders.filter((o) =>
      tab === 'Live Orders' ? o.status !== 'COMPLETED' : o.status === 'COMPLETED',
    )}
    <div class="section-label">
      <h2>{tab} <span class="muted">({shown.length})</span></h2>
      <button class="text-button" onclick={load}>Refresh ↻</button>
    </div>
    {#if !shown.length}<div class="panel empty-state">
        <Icon name="bag" size={42} />
        <h2>{tab === 'Live Orders' ? 'All caught up.' : 'A fresh start.'}</h2>
        <p>
          {tab === 'Live Orders'
            ? 'New orders will appear here automatically.'
            : 'Completed orders will be saved here.'}
        </p>
      </div>{/if}
    <div class="employee-orders">
      {#each shown as order}<article class="panel order-ticket">
          <div class="ticket-top">
            <strong>{order.id}</strong><span class="status-pill">{order.status}</span>
          </div>
          <h2>{order.name}</h2>
          <small>{new Date(order.createdAt).toLocaleString()}</small
          >{#each order.lines as line, i}<div class="ticket-line">
              <div>
                <strong>{line.quantity} × {line.name}</strong><small
                  >{line.option} {line.note}</small
                ><small
                  >{line.price === null
                    ? 'Price confirmation needed'
                    : money(line.price) + ' each'}</small
                >
              </div>
              <strong>{line.price === null ? 'Pending' : money(line.price * line.quantity)}</strong>
            </div>
            {#if line.price === null}<div class="inline-form">
                <input
                  aria-label={'Price for ' + line.name}
                  inputmode="decimal"
                  placeholder="Price each ($)"
                  bind:value={customValues[order.id + i]}
                /><button class="secondary" disabled={busy} onclick={() => customPrice(order, i)}
                  >Confirm price</button
                >
              </div>{/if}{/each}
          <div class="totals">
            <p><span>Subtotal</span><span>{money(order.subtotal)}</span></p>
            {#if order.discount}<p class="savings">
                <span>{order.promotion}</span><span>−{money(order.discount)}</span>
              </p>{/if}
            <p><span>Tax</span><span>$0.00</span></p>
            <p class="total">
              <span>{order.pending ? 'Known total' : 'Total'}</span><strong
                >{money(order.total)}</strong
              >
            </p>
          </div>
          {#if order.status !== 'COMPLETED'}<button
              class="primary wide"
              disabled={busy || order.pending}
              onclick={() =>
                update(order, { status: statuses[statuses.indexOf(order.status) + 1] })}
              >Mark {statuses[statuses.indexOf(order.status) + 1].toLowerCase()}
              <Icon name="arrow" /></button
            >{/if}
        </article>{/each}
    </div>
  {:else if tab === 'Menu Manager' || tab === 'Price Manager'}<div class="panel">
      <h2>
        {tab === 'Menu Manager' ? 'Keep the menu fresh.' : 'A fair price for every favorite.'}
      </h2>
      <p>Changes update all connected stations. Previously submitted orders keep their prices.</p>
      {#each menu as item}<div class="manager-row">
          <span class="manager-emoji">{item.emoji}</span>
          <div>
            <strong>{item.name}</strong><small
              >{item.kids ? 'Kids menu' : 'Main menu'} · {item.category}</small
            >
          </div>
          {#if tab === 'Menu Manager'}<button
              class={item.available === false ? 'sold-toggle' : 'available-toggle'}
              disabled={busy}
              onclick={() =>
                setting({ item: { id: item.id, available: item.available === false } })}
              >{item.available === false ? 'Sold out' : 'Available'}</button
            >{:else if item.price !== null}<input
              aria-label={'Price for ' + item.name}
              inputmode="decimal"
              value={priceValues[item.id] ?? (item.price / 100).toFixed(2)}
              oninput={(e) => (priceValues[item.id] = e.currentTarget.value)}
            /><button class="secondary" disabled={busy} onclick={() => savePrice(item)}>Save</button
            >{:else}<small>Confirm per order</small>{/if}
        </div>{/each}
    </div>
  {:else if tab === 'Restaurant Open / Closed'}<div class="panel settings-panel">
      <Icon name="sun" size={40} />
      <h2>{settings.open ? 'The kitchen is open.' : 'Taking a little break.'}</h2>
      <p>Guests can always browse. New orders are accepted only while the restaurant is open.</p>
      <button class="primary" disabled={busy} onclick={() => setting({ open: !settings.open })}
        >{settings.open ? 'Close restaurant' : 'Open restaurant'}</button
      >
    </div>
  {:else if tab === 'Station Management'}<div class="panel settings-panel">
      <h2>Make this station your own.</h2>
      <label for="station">This device’s station name</label><input
        id="station"
        bind:value={station}
        maxlength="60"
        oninput={() => localStorage.setItem('barn-station', station)}
      />
      <p>
        This label is saved on this device. Open Employee access on the employee iPad to receive
        orders; use Welcome on the customer iPad.
      </p>
      <label class="check-label"
        ><input type="checkbox" bind:checked={wake} onchange={saveWake} /> Keep this screen awake where
        supported</label
      >
      <p class="fine-print">Wake Lock requires a supported browser and an active, secure page.</p>
    </div>
  {:else if tab === 'Display Settings'}<div class="panel settings-panel">
      <h2>A comfortable view.</h2>
      <label class="check-label"
        ><input type="checkbox" bind:checked={large} onchange={saveDisplay} /> Larger text on this device</label
      >
      <p>Animation automatically follows your device’s reduced-motion preference.</p>
    </div>
  {:else}<div class="panel settings-panel">
      <h2>The little details.</h2>
      <label class="check-label"
        ><input
          type="checkbox"
          checked={settings.promotions}
          disabled={busy}
          onchange={(e) => setting({ promotions: e.currentTarget.checked })}
        /> Enable menu specials</label
      >
      <p>Tax: <strong>$0.00</strong> · Currency: <strong>USD</strong></p>
      <p>Menu revision: {settings.revision}</p>
      <p>
        Payment is collected by your waiter. Weather and celebration animations are optional and
        never required for orders.
      </p>
    </div>{/if}{/if}
