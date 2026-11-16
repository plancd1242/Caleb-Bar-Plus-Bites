<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/style.css';
  import Icon from '$lib/components/Icon.svelte';
  import MenuViewer from '$lib/components/MenuViewer.svelte';
  import Weather from '$lib/components/Weather.svelte';
  import OrderFlow from '$lib/components/OrderFlow.svelte';
  import Employee from '$lib/components/Employee.svelte';
  import { currentMenu, defaultSettings } from '$lib/menu';
  import type { CartLine, MenuItem, Order, Settings } from '$lib/types';
  import Announcements from '$lib/components/Announcements.svelte';
  import { weatherEnabled } from '$lib/announcements';
  import { defaultSeasonal, seasonalSettings } from '$lib/seasonal';
  import { statuses } from '$lib/types';
  import { money } from '$lib/pricing';
  import { api } from '$lib/api';
  let updateReady = false;
  $: theme = seasonalSettings(settings.seasonal);
  let page = 'welcome';
  let seasonalFocus = false;
  let orderSpecial: MenuItem | null = null;
  let drawer = false;
  let now = new Date();
  let connection = 'Reconnecting…';
  let authorized = false;
  let menu: MenuItem[] = currentMenu(defaultSettings);
  let settings: Settings = structuredClone(defaultSettings);
  let cart: CartLine[] = [];
  let receipt: Order | null = null;
  let storageError = '';
  let gif: string | null = null;
  let hold: ReturnType<typeof setTimeout>;
  let tick: ReturnType<typeof setInterval>;
  let socket: WebSocket;
  let retry: ReturnType<typeof setTimeout>;
  let poll: ReturnType<typeof setInterval>;
  let disposed = false;
  let connecting = false;
  let wakeLock: WakeLockSentinel | null = null;
  let reconnectAttempt = 0;
  const nav = [
    { id: 'welcome', label: 'Welcome', icon: 'home' },
    { id: 'order', label: 'Place Your Order', icon: 'bag' },
    { id: 'main', label: 'Main Menu', icon: 'book' },
    { id: 'kids', label: 'Kids Menu', icon: 'kids' },
    ...(weatherEnabled ? [{ id: 'weather', label: 'Weather', icon: 'sun' }] : []),
    { id: 'time', label: 'Time', icon: 'clock' },
  ];
  $: itemCount = cart.reduce((s, l) => s + l.quantity, 0);
  function navigate(next: string) {
    page = next;
    drawer = false;
    if (typeof window !== 'undefined') {
      location.hash = next;
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function saveCart(value: CartLine[]) {
    cart = value;
    try {
      localStorage.setItem('barn-cart', JSON.stringify(cart));
    } catch {
      storageError =
        'Your device can’t save this basket. Keep the app open until your order is confirmed.';
    }
  }
  async function refresh() {
    const data = await api<{ menu: MenuItem[]; settings: Settings }>('/menu');
    menu = data.menu;
    settings = data.settings;
    try {
      localStorage.setItem('barn-menu', JSON.stringify(data));
    } catch {
      /* Browsing still works when storage is full. */
    }
    if (receipt) {
      const orders = await api<Order[]>('/orders');
      receipt = orders.find((o) => o.id === receipt?.id) ?? receipt;
    }
    window.dispatchEvent(new Event('barn-refresh'));
  }
  async function connect() {
    if (disposed || connecting) return;
    connecting = true;
    clearTimeout(retry);
    try {
      const session = await api<{ employee: boolean }>('/session');
      authorized = session.employee;
      if (!receipt) {
        let id: string | null = null;
        try {
          id = localStorage.getItem('barn-receipt');
        } catch {}
        if (id) {
          const orders = await api<Order[]>('/orders');
          receipt = orders.find((o) => o.id === id) ?? null;
        }
      }
      await refresh();
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/events`,
      );
      socket.onopen = () => {
        connection = 'Connected';
        reconnectAttempt = 0;
      };
      socket.onmessage = (e) => {
        if (e.data !== 'pong') void refresh().catch(() => (connection = 'Reconnecting…'));
      };
      socket.onclose = () => {
        if (!disposed) {
          connection = navigator.onLine ? 'Reconnecting…' : 'Offline';
          retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** reconnectAttempt++));
        }
      };
      socket.onerror = () => socket.close();
    } catch {
      connection = navigator.onLine ? 'Reconnecting…' : 'Offline';
      retry = setTimeout(connect, Math.min(30000, 2000 * 2 ** reconnectAttempt++));
    } finally {
      connecting = false;
    }
  }
  async function wake() {
    try {
      if (
        localStorage.getItem('barn-wake') === 'true' &&
        document.visibilityState === 'visible' &&
        'wakeLock' in navigator
      ) {
        wakeLock = await navigator.wakeLock.request('screen');
      } else {
        await wakeLock?.release();
      }
    } catch {
      /* Wake Lock is optional. */
    }
  }
  function showReceipt(order: Order) {
    try {
      localStorage.removeItem('barn-checkout');
    } catch {}
    receipt = order;
    navigate('confirmation');
    try {
      localStorage.setItem('barn-receipt', order.id);
    } catch {}
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      void api<{ url: string | null }>('/celebration')
        .then((data) => (gif = data.url))
        .catch(() => {});
  }
  function startAnother() {
    receipt = null;
    gif = null;
    try {
      localStorage.removeItem('barn-receipt');
    } catch {}
    navigate('order');
  }
  onMount(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration) return;
        updateReady = !!registration.waiting;
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', () => {
            updateReady = !!registration.waiting;
          });
        });
        void registration.update().catch(() => {});
      });
    disposed = false;
    try {
      const saved = JSON.parse(localStorage.getItem('barn-cart') ?? '[]');
      if (Array.isArray(saved))
        cart = saved.filter(
          (l) =>
            l &&
            typeof l.id === 'string' &&
            Number.isInteger(l.quantity) &&
            l.quantity > 0 &&
            l.quantity <= 20 &&
            typeof l.note === 'string' &&
            typeof l.option === 'string',
        );
      const cached = JSON.parse(localStorage.getItem('barn-menu') ?? 'null');
      if (
        Array.isArray(cached?.menu) &&
        cached.menu.every(
          (item: MenuItem) =>
            item &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.description === 'string' &&
            typeof item.emoji === 'string' &&
            ['Bites', 'Mocktails', 'Desserts', 'Drinks', 'Specials', 'Custom'].includes(
              item.category,
            ) &&
            (item.price === null || (Number.isInteger(item.price) && item.price >= 0)),
        ) &&
        typeof cached?.settings?.open === 'boolean' &&
        Number.isInteger(cached?.settings?.revision) &&
        typeof cached?.settings?.promotions === 'boolean'
      ) {
        menu = cached.menu;
        settings = cached.settings;
      }
      document.documentElement.classList.toggle(
        'large-type',
        localStorage.getItem('barn-large') === 'true',
      );
    } catch {
      storageError = 'A saved draft couldn’t be read. Please check your basket.';
    }
    const hash = () => {
      const id = location.hash.slice(1);
      if ([...nav.map((n) => n.id), 'employee', 'confirmation'].includes(id)) page = id;
      drawer = false;
    };
    hash();
    window.addEventListener('hashchange', hash);
    tick = setInterval(() => (now = new Date()), 1000);
    void connect();
    poll = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send('ping');
      void refresh().catch(() => {
        connection = navigator.onLine ? 'Reconnecting…' : 'Offline';
      });
    }, 15000);
    const online = () => void connect();
    const offline = () => {
      connection = 'Offline';
      socket?.close();
    };
    const visibility = () => {
      void wake();
      if (document.visibilityState === 'visible') void connect();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('barn-wake', wake);
    void wake();

    return () => {
      disposed = true;
      clearInterval(tick);
      clearInterval(poll);
      clearTimeout(retry);
      clearTimeout(hold);
      socket?.close();
      void wakeLock?.release();
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('barn-wake', wake);
    };
  });
</script>

<svelte:head><title>Caleb Bar + Bites · Good food. Brighter days.</title></svelte:head>
<div
  class="app-shell"
  class:thanksgiving={theme.thanksgiving}
  class:seasonal-motion={theme.animations && !theme.lightweight}
  class:lightweight={theme.lightweight}
>
  {#if drawer}<button
      class="drawer-scrim"
      aria-label="Close navigation"
      onclick={() => (drawer = false)}
    ></button>{/if}
  <aside class="sidebar" class:open={drawer}>
    <a class="brand" href="#welcome" onclick={() => navigate('welcome')}
      ><img src="/icons/logo.png" alt="Caleb Bar + Bites illustrated restaurant logo" /><span
        >Caleb’s<small>BAR + BITES</small></span
      ></a
    >
    <div class="sidebar-rule"></div>
    <p class="nav-label">MAKE YOURSELF AT HOME</p>
    <nav aria-label="Main navigation">
      {#each nav as item}<button
          class:active={page === item.id}
          aria-current={page === item.id ? 'page' : undefined}
          onclick={() => navigate(item.id)}
          ><Icon name={item.icon} /><span>{item.label}</span
          >{#if item.id === 'order' && itemCount}<b class="nav-count">{itemCount}</b
            >{:else if page === item.id}<span class="nav-dot"></span>{/if}</button
        >{/each}
    </nav>
    <div class="employee-link">
      <button class:active={page === 'employee'} onclick={() => navigate('employee')}
        ><Icon name="lock" size={19} /><span>Settings<small>EMPLOYEES ONLY</small></span></button
      >
    </div>
    <div class="sidebar-bottom">
      <div class="little-sign">
        <Icon name="leaf" size={24} />
        <p>Good food.<br />Great drinks.<br /><em>Brighter days.</em></p>
        <span>✦</span>
      </div>
      <button
        class="secret-logo"
        aria-label="Hold for employee access"
        onpointerdown={() => (hold = setTimeout(() => navigate('employee'), 2000))}
        onpointerup={() => clearTimeout(hold)}
        onpointercancel={() => clearTimeout(hold)}
        onpointerleave={() => clearTimeout(hold)}
        oncontextmenu={(e) => e.preventDefault()}
        ><img src="/icons/logo.png" alt="Caleb Bar + Bites illustrated logo" /></button
      ><span class="sidebar-bottom-text">A little happy place. ♡</span>
    </div>
  </aside>
  <div class="main-shell">
    <header class="topbar">
      <div class="topbar-left">
        <button class="mobile-menu" aria-label="Open navigation" onclick={() => (drawer = !drawer)}
          ><Icon name="menu" /></button
        ><span class="breadcrumb">WELCOME TO HAVEN HILL FARM <span>✦</span></span>
      </div>
      <div class="header-status">
        <span class="open-status" class:closed={!settings.open}
          ><i></i>{settings.open ? 'Open & happy to see you' : 'Currently closed'}</span
        ><span class="connection" class:disconnected={connection !== 'Connected'}
          ><Icon name="wifi" size={16} /><span>{connection}</span></span
        >
      </div>
    </header>
    <main>
      {#if updateReady}<div class="notice" role="status">
          An app update is ready. Finish your order, then close all Caleb’s app windows and reopen
          to update safely.
        </div>{/if}
      {#if theme.thanksgiving}<div class="festive-banner">
          <strong>🎉 GRAND OPENING — NOVEMBER 26, 2026</strong>
          <p>Happy Thanksgiving from Caleb’s Bar + Bites!</p>
        </div>{/if}
      {#if theme.decorations}<div
          class="seasonal-decor"
          class:leaves-falling={theme.fallingLeaves &&
            theme.leaves &&
            theme.animations &&
            !theme.lightweight}
          aria-hidden="true"
        >
          {#if theme.leaves}<span class="leaf-art">🍂</span><span class="leaf-art">🍁</span>{/if}
          {#if theme.confetti}<span class="confetti-art">✦ · ✧ · ✦</span>{/if}
        </div>
        {#if theme.pumpkins}<img
            class="autumn-decoration"
            src="/art/autumn-lite.svg"
            alt=""
            width="140"
            height="63"
            loading="lazy"
            decoding="async"
          />{/if}
        {#if theme.other && !theme.lightweight}<div class="festive-friends" aria-hidden="true">
            <img
              src="/art/seasonal-table.webp"
              alt=""
              width="140"
              height="95"
              loading="lazy"
              decoding="async"
            />
          </div>{/if}
      {/if}
      {#if storageError}<div class="notice" role="alert">{storageError}</div>{/if}
      {#if page === 'welcome' || page === 'main' || page === 'kids'}<div
          class="notice cherry-recipe-note"
          role="note"
        >
          Menu correction: Cherry Pop is made without lime juice. The printed artwork may still list
          lime juice.
        </div>{/if}
      {#if page === 'welcome'}<div class="welcome-heading">
          <p class="eyebrow"><span class="tiny-leaf">✦</span> PULL UP A CHAIR. STAY A LITTLE.</p>
          <p class="welcome-date">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <section class="hero">
          <div class="hero-copy">
            <div class="hero-kicker"><span></span> GOOD FOOD. GOOD COMPANY.</div>
            <h1>
              Welcome to<br />Caleb’s<br /><span>Bar + Bites<span class="hand-star">✳</span></span>
            </h1>
            <p>A little bite. A colorful sip.<br />A whole lot of happy.</p>
            <button class="primary hero-cta" onclick={() => navigate('order')}
              ><Icon name="bag" size={21} /> Order Here <Icon name="arrow" /></button
            >
            <div class="hero-footnote"><span>♡</span> Made with care. Served with a smile.</div>
          </div>
          {#if theme.farm}<div class="hero-art">
              <img
                src={theme.lightweight ? '/art/farm.svg' : '/art/farm-illustrated.webp'}
                alt="A welcoming Haven Hill Farm with a barn, pasture animals, wooden fences and autumn trees"
              />
              <div class="art-badge">
                <Icon name="sun" size={25} /><span
                  >Life by the Farm<br /><strong>Haven Hill Farm</strong></span
                >
              </div>
              <div class="wood-label">SIPS · BITES · GOOD TIMES</div>
            </div>{/if}
        </section>
        <div class="welcome-section-label">
          <h2>Find your kind of happy.</h2>
          <span>Something for every appetite.</span>
        </div>
        <div class="quick-cards">
          <button class="quick-card menu-card" onclick={() => navigate('main')}
            ><span class="quick-icon"><Icon name="book" size={28} /></span><span class="quick-copy"
              ><small>THE CLASSICS & THE CRAVINGS</small><strong>View Menu</strong><span
                >Bites, sips & sweet little treats.</span
              ></span
            ><span class="round-arrow">↗</span></button
          ><button class="quick-card kids-card" onclick={() => navigate('kids')}
            ><span class="quick-icon"><Icon name="kids" size={30} /></span><span class="quick-copy"
              ><small>LITTLE BITES. BIG SMILES.</small><strong>Just for the kids</strong><span
                >Good food. A little extra fun.</span
              ></span
            ><span class="round-arrow">↗</span></button
          >
        </div>
        <div class="welcome-bottom">
          <Announcements
            {settings}
            {now}
            explore={() => {
              seasonalFocus = true;
              navigate('order');
            }}
          />
          <button class="time-card" onclick={() => navigate('time')}
            ><Icon name="clock" size={25} />
            <div>
              <p class="eyebrow">YOU’RE RIGHT ON TIME</p>
              <strong
                >{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</strong
              ><span>Take it slow. You’re at Caleb’s.</span>
            </div></button
          >
          <div class="special-card">
            <span>✦ A LITTLE SOMETHING SPECIAL</span>
            <h3>A little something special.</h3>
            <p>A bite + a mocktail.<br />Explore available offers at checkout.</p>
            <button class="text-button" onclick={() => navigate('order')}
              >Find your pair <Icon name="arrow" size={17} /></button
            >
          </div>
        </div>
        <footer class="welcome-footer">
          <span><Icon name="leaf" size={16} /> SAME GREAT FOOD. JUST A BRIGHTER DAY.</span><span
            >Eat. Sip. Smile. Repeat. ♡</span
          >
        </footer>
      {:else if page === 'main' || page === 'kids'}{#key page}<MenuViewer
            {menu}
            onSpecial={(item) => {
              orderSpecial = item;
              navigate('order');
            }}
            kids={page === 'kids'}
            onOrder={() => navigate('order')}
          />{/key}
      {:else if page === 'order'}<OrderFlow
          initialSeasonal={seasonalFocus}
          initialSpecial={orderSpecial}
          onSpecialHandled={() => {
            orderSpecial = null;
            seasonalFocus = false;
          }}
          {menu}
          {settings}
          {cart}
          {navigate}
          onCart={saveCart}
          onReceipt={showReceipt}
        />
      {:else if page === 'employee'}<Employee
          {menu}
          {settings}
          {authorized}
          {refresh}
          onAuth={(value) => {
            authorized = value;
          }}
        />
      {:else if weatherEnabled && page === 'weather'}<div class="page-heading">
          <div>
            <p class="eyebrow">A MOMENT OUTSIDE</p>
            <h1>The view looks good on you.</h1>
            <p>A little local weather, wherever you are.</p>
          </div>
        </div>
        <section class="weather-page panel">
          <Weather /><img src="/art/farm.svg" alt="Farm animals in rolling autumn fields" />
        </section>
      {:else if page === 'time'}<section class="clock-page">
          <p class="eyebrow">NO NEED TO RUSH</p>
          <Icon name="sun" size={45} />
          <h1>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</h1>
          <p>
            {now.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <span>Good times are on the menu. ♡</span><small
            >Your device’s local time · {Intl.DateTimeFormat().resolvedOptions().timeZone}</small
          >
        </section>
      {:else if page === 'confirmation'}{#if receipt}<section class="confirmation panel">
            <div class="confirmation-check"><Icon name="check" size={42} /></div>
            <p class="eyebrow">✓ Order Submitted!</p>
            <h1>You’re in good hands, {receipt.name}.</h1>
            <p>A little deliciousness is on its way.</p>
            <div class="receipt-summary">
              <div><small>YOUR ORDER</small><strong>{receipt.id}</strong></div>
              <div>
                <small>{receipt.pending ? 'KNOWN TOTAL' : 'YOUR TOTAL'}</small><strong
                  >{money(receipt.total)}</strong
                >
              </div>
            </div>
            {#if receipt.pending}<div class="notice">
                Custom prices are awaiting employee confirmation. Your total will update here.
              </div>{/if}
            <div class="status-track" aria-label={'Order status: ' + receipt.status}>
              {#each statuses as status, i}<div class:done={i <= statuses.indexOf(receipt.status)}>
                  <span>{i < statuses.indexOf(receipt.status) ? '✓' : i + 1}</span><small
                    >{status}</small
                  >
                </div>{/each}
            </div>
            <p>
              Payment status: {receipt.paymentStatus === 'confirmed'
                ? 'Confirmed by staff'
                : 'Not confirmed'}. Submitting an order does not confirm payment.
            </p>
            <div class="payment-note">
              <strong>Please deposit your exact payment at the Payment Station.</strong>
              <p>Need change or assistance? Ring the bell!</p>
            </div>
            {#if gif}<img
                class="celebration-gif"
                src={gif}
                alt="A little food celebration"
                onerror={() => (gif = null)}
              /><small>Powered by GIPHY</small>{/if}<button class="primary" onclick={startAnother}
              >Start another order <Icon name="arrow" /></button
            >
          </section>{:else}<div class="panel empty-state">
            <h1>Ready for something good?</h1>
            <p>Your sent order will appear here after the kitchen confirms receipt.</p>
            <button class="primary" onclick={() => navigate('order')}>Place your order</button>
          </div>{/if}{/if}
    </main>
  </div>
</div>
