<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import type { CartLine, MenuItem, Order, Promotion, Quote, Settings } from '$lib/types';
  import { quote, money } from '$lib/pricing';
  import { api } from '$lib/api';
  import { seasonalSettings } from '$lib/seasonal';
  import Icon from './Icon.svelte';
  export let menu: MenuItem[];
  export let initialSeasonal = false;
  export let initialSpecial: MenuItem | null = null;
  export let onSpecialHandled: () => void = () => {};
  export let settings: Settings;
  export let cart: CartLine[];
  export let navigate: (page: string) => void;
  export let onCart: (value: CartLine[]) => void;
  export let onReceipt: (order: Order) => void;
  function showDialog(node: HTMLDialogElement) {
    node.showModal();
    return { destroy: () => node.close() };
  }
  let kids = false;
  let category = 'All';
  let step = 1;
  let name = '';
  let promotion: Promotion = 'none';
  let offerId = '';
  let coupon = '';
  let approvalToken = '';
  let customerId = '';
  let additions: { id: number; item: string }[] = [];
  let additionId = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function ordered(item: MenuItem) {
    const id = ++additionId;
    additions = [...additions, { id, item: item.id }];
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document
        .querySelector<HTMLButtonElement>('[data-add-id="' + CSS.escape(item.id) + '"]')
        ?.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
          { duration: 200 },
        );
    }
    const timer = setTimeout(() => {
      additions = additions.filter((a) => a.id !== id);
      timers.delete(timer);
    }, 1000);
    timers.add(timer);
  }
  onDestroy(() => timers.forEach(clearTimeout));
  $: seasonalItems = visible.filter((i) => i.seasonal);
  $: regularItems = visible.filter((i) => !i.seasonal);
  $: activeOffers = (settings.offers ?? []).filter(
    (o) =>
      settings.promotions &&
      o.enabled &&
      o.eligibility !== 'member' &&
      Date.now() >= Date.parse(o.starts) &&
      Date.now() < Date.parse(o.expires),
  );
  let error = '';
  let busy = false;
  let quoteData: Quote | null = null;
  let selected: MenuItem | null = null;
  let note = '';
  let option = '';
  let requestId = '';
  let pending = false;
  $: theme = seasonalSettings(settings.seasonal);
  const categories = [
    'All',
    'Thanksgiving Specials',
    'Bites',
    'Mocktails',
    'Desserts',
    'Drinks',
    'Specials',
    'Custom',
  ];
  $: visible = menu.filter(
    (i) =>
      i.available !== false &&
      i.visibility !== 'menu' &&
      Boolean(i.kids) === kids &&
      (category === 'All' ||
        (category === 'Thanksgiving Specials'
          ? i.seasonal
          : category === 'Specials'
            ? i.special || i.category === 'Specials'
            : i.category === category)),
  );
  $: preview = (() => {
    try {
      return quote(cart, menu, 'none', settings.revision);
    } catch {
      return null;
    }
  })();
  $: stale = !!quoteData && quoteData.revision !== settings.revision;
  $: count = cart.reduce((s, l) => s + l.quantity, 0);
  onMount(() => {
    void api<{ customer: string }>('/session')
      .then((s) => (customerId = s.customer))
      .catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem('barn-checkout') ?? 'null');
      if (saved) {
        name = typeof saved.name === 'string' ? saved.name.slice(0, 60) : '';
        promotion = 'none';
        offerId = typeof saved.offerId === 'string' ? saved.offerId : '';
        requestId =
          typeof saved.requestId === 'string' && /^[a-f0-9-]{36}$/.test(saved.requestId)
            ? saved.requestId
            : '';
        pending = !!requestId;
      }
    } catch {
      /* A damaged draft never blocks ordering. */
    }
    if (initialSpecial) {
      kids = !!initialSpecial.kids;
      category = 'Specials';
      const item = menu.find((i) => i.id === initialSpecial?.id && i.available !== false);
      if (item && !pending) add(item);
      onSpecialHandled();
    }
    if (initialSeasonal) {
      kids = false;
      category = 'Thanksgiving Specials';
      onSpecialHandled();
      void tick().then(() =>
        document.getElementById('seasonal-specials')?.scrollIntoView({ block: 'start' }),
      );
    }
  });
  function change(lines: CartLine[]) {
    if (pending) return;
    error = '';
    quoteData = null;
    cart = lines;
    onCart(lines);
    return true;
  }
  function add(item: MenuItem) {
    if (pending || item.available === false || item.visibility === 'menu') return;
    if (item.options || item.category === 'Custom') {
      selected = item;
      note = '';
      option = item.options?.[0] ?? '';
    } else addLine(item, '', '');
  }
  function addLine(item: MenuItem, note: string, option: string) {
    const current = menu.find((i) => i.id === item.id);
    if (!current || current.available === false || current.visibility === 'menu') {
      error = 'This item is no longer available.';
      return;
    }
    if (pending || item.available === false || item.visibility === 'menu') return;
    const index = cart.findIndex((l) => l.id === item.id && l.note === note && l.option === option);
    if (index >= 0 && cart[index].quantity >= 20) {
      error = 'Maximum 20 of each item.';
      return;
    }
    const next = cart.map((l) => ({ ...l }));
    if (index >= 0) next[index].quantity++;
    else next.push({ id: item.id, quantity: 1, note, option });
    if (change(next)) ordered(item);
    selected = null;
  }
  function quantity(index: number, delta: number) {
    const next = cart.map((l) => ({ ...l }));
    next[index].quantity += delta;
    if (next[index].quantity > 20) {
      error = 'Maximum 20 of each item.';
      return;
    }
    change(next.filter((l) => l.quantity > 0));
  }
  async function review() {
    error = '';
    quoteData = null;
    try {
      quoteData = await api<Quote>('/quote', {
        cart,
        promotion: 'none',
        offerId,
        coupon,
        approvalToken,
      });
      step = 2;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Couldn’t check your basket. Your items are saved.';
    }
  }
  function saveDraft() {
    try {
      localStorage.setItem(
        'barn-checkout',
        JSON.stringify({ name, promotion, requestId, offerId }),
      );
    } catch {
      error = 'Device storage is unavailable. Keep this page open until your order is confirmed.';
    }
  }
  async function submit() {
    if (busy) return;
    if (!pending && stale) {
      error = 'The menu changed. Review your basket again before sending.';
      return;
    }
    if (!quoteData || name.trim().length < 2) {
      error = 'Please enter a name with at least 2 characters.';
      return;
    }
    busy = true;
    error = '';
    requestId = requestId || crypto.randomUUID();
    pending = true;
    saveDraft();
    try {
      const order = await api<Order>('/orders', {
        cart,
        name,
        promotion: 'none',
        offerId,
        coupon,
        approvalToken,
        requestId,
        total: quoteData.total,
        revision: quoteData.revision,
      });
      onCart([]);
      try {
        localStorage.removeItem('barn-checkout');
      } catch {}
      onReceipt(order);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Couldn’t send. Your basket is safe. Please retry.';
    } finally {
      busy = false;
    }
  }
  async function resolvePending() {
    busy = true;
    try {
      const { order: latest } = await api<{ order: Order | null }>('/recover', { requestId });
      if (latest) {
        onCart([]);
        onReceipt(latest);
      } else {
        pending = false;
        requestId = '';
        saveDraft();
        quoteData = null;
        step = 1;
      }
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : 'Reconnect before editing this order so we can check whether it arrived.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="ordered-feedback" aria-live="polite" aria-atomic="false">
  {#each additions as addition (addition.id)}<div class="ordered-toast">✓ Ordered!</div>{/each}
</div>
<div class="page-heading">
  <div>
    <p class="eyebrow">FRESHLY MADE. HAPPILY SHARED.</p>
    <h1>What sounds good?</h1>
    <p>A little bite, a colorful sip, or a bit of everything.</p>
  </div>
  <span class="small-tag">100% alcohol-free mocktails</span>
</div>
<div class="order-steps">
  <button class:current={step === 1} onclick={() => (step = 1)}
    >1 <span>Choose your favorites</span></button
  >
  <div></div>
  <button class:current={step === 2} disabled={!cart.length} onclick={review}
    >2 <span>Review your basket</span></button
  >
  <div></div>
  <button class:current={step === 3} disabled={!quoteData} onclick={() => (step = 3)}
    >3 <span>Your name & send</span></button
  >
</div>
{#if error}<div class="notice error" role="alert">{error}</div>{/if}
{#if stale && !pending}<div class="notice" role="alert">
    The menu changed. Review your basket again to confirm current prices and availability.
    <button
      class="secondary"
      onclick={() => {
        quoteData = null;
        step = 1;
      }}>Review updated basket</button
    >
  </div>{/if}
{#if pending}<div class="notice">
    This order may already be on its way. Retry with the same order details, or <button
      class="text-button"
      disabled={busy}
      onclick={resolvePending}>check before editing</button
    >.
  </div>{/if}
{#if !settings.open}<div class="notice">
    We’re taking a little break. Browse and build your basket; ordering resumes when we open.
  </div>{/if}
<div class="ordering-layout">
  <section>
    {#if step === 1}
      <div class="order-menu-links">
        <div class="segmented">
          <button
            class:chosen={!kids}
            onclick={() => {
              kids = false;
              category = 'All';
            }}>Main menu</button
          ><button
            class:chosen={kids}
            onclick={() => {
              kids = true;
              category = 'All';
            }}>Kids menu 🐾</button
          >
        </div>
        <button class="text-button" onclick={() => navigate(kids ? 'kids' : 'main')}
          >Look at the {kids ? 'kids' : 'main'} menu <Icon name="book" size={18} /></button
        >
      </div>
      <div class="category-tabs">
        {#each categories.filter((c) => !kids || !['Desserts'].includes(c)) as c}<button
            class:active={category === c}
            onclick={() => (category = c)}>{c}</button
          >{/each}
      </div>
      {#if category === 'Thanksgiving Specials' && !seasonalItems.length}<section
          id="seasonal-specials"
        >
          <h2>🦃 Thanksgiving Grand Opening Specials</h2>
          <p>Our seasonal menu is being prepared. Ask staff which specials are available.</p>
        </section>{/if}
      {#each [{ title: '🦃 Thanksgiving Grand Opening Specials', items: seasonalItems }, { title: '', items: regularItems }] as group}
        {#if group.items.length}{#if group.title}<h2 id="seasonal-specials">{group.title}</h2>
            <p>
              Approved Thanksgiving portions and deals. Photos are representative; see descriptions
              for exact servings. <a
                href="/special-photo-credits.html"
                target="_blank"
                rel="noopener">Photo credits</a
              >
            </p>{/if}
          <div class="item-grid">
            {#each group.items as item}<article
                class="item-card"
                class:soldout={item.available === false}
              >
                <div class="food-art" class:berry={item.category === 'Mocktails'}>
                  {#if item.image || (!theme.lightweight && !item.seasonal && ['Bites', 'Mocktails', 'Desserts', 'Drinks'].includes(item.category))}<img
                      class="menu-food-image"
                      src={item.image ?? '/art/seasonal-table.webp'}
                      alt={item.image
                        ? item.name + ' — representative food photograph'
                        : 'Seasonal food illustration'}
                      loading="lazy"
                      decoding="async"
                      width="320"
                      height="170"
                    />{:else}<span>{item.emoji}</span>{/if}<small
                    >{item.special
                      ? 'SPECIAL'
                      : item.kids
                        ? 'LITTLE FAVORITES'
                        : item.category.toUpperCase()}</small
                  >
                </div>
                <div class="item-body">
                  <h3>{item.name}</h3>
                  <p>{item.description || 'A classic, refreshing choice.'}</p>
                  {#if item.id === 'harvest-cheese-bites'}<small
                      >Grilled cheese reference photo; your serving is cut into bite-sized pieces.</small
                    >{/if}
                  {#if item.bundle}<small class="deal-note"
                      >Fixed contents · no extra promotion · lower separate price applies if cheaper</small
                    >{/if}
                  <div class="item-bottom">
                    <strong>{item.price === null ? 'Price to confirm' : money(item.price)}</strong
                    ><button
                      data-add-id={item.id}
                      class="add-button"
                      class:just-added={additions.some((a) => a.item === item.id)}
                      aria-label={'Add ' + item.name}
                      disabled={item.available === false || pending}
                      onclick={() => add(item)}
                      >{item.available === false ? 'Sold out' : '+'}</button
                    >
                  </div>
                </div>
              </article>{/each}
          </div>
        {/if}
      {/each}
    {:else if step === 2}<div class="panel">
        <p class="eyebrow">ONE MORE LOOK</p>
        <h2>Your happy little lineup.</h2>
        <p>Check your items on the right. Any custom prices will be confirmed by an employee.</p>
        <label for="offer">Available offers</label><select
          id="offer"
          bind:value={offerId}
          disabled={pending}
          onchange={() => {
            quoteData = null;
          }}
        >
          <option value="">No offer</option>{#each activeOffers as offer}<option value={offer.id}
              >{offer.name}</option
            >{/each}
        </select>
        {#if offerId}<p>Eligibility is checked by the server. Only one verified offer can apply.</p>
          {#if activeOffers.find((o) => o.id === offerId)?.eligibility === 'coupon'}<label
              for="coupon">Coupon code</label
            ><input
              id="coupon"
              bind:value={coupon}
              maxlength="100"
              disabled={pending}
              oninput={() => (quoteData = null)}
            />{/if}
          {#if activeOffers.find((o) => o.id === offerId)?.eligibility === 'manager'}<p>
              Show staff your approval request ID: <code>{customerId}</code>
            </p>
            <label for="approval-token">Manager approval token</label><input
              id="approval-token"
              bind:value={approvalToken}
              maxlength="100"
              disabled={pending}
              oninput={() => (quoteData = null)}
            />{/if}
        {/if}
        <button class="secondary" disabled={busy || pending} onclick={review}
          >Verify offer and total</button
        >
        <p class="fine-print">
          Unconfigured and member-only offers are unavailable. Coupons expire and cannot be stacked.
          Changing your cart requires a new server review.
        </p>
        <button class="primary wide" disabled={!quoteData || stale} onclick={() => (step = 3)}
          >Looks good. Continue <Icon name="arrow" /></button
        ><button class="text-button" onclick={() => (step = 1)}>← Add a little more</button>
      </div>
    {:else}<div class="panel">
        <p class="eyebrow">LET’S MAKE IT YOURS</p>
        <h2>What name should we call?</h2>
        <p>We’ll use this to match your food and your payment.</p>
        <label for="customer-name">Your name</label><input
          id="customer-name"
          autocomplete="given-name"
          maxlength="60"
          placeholder="e.g. Caleb"
          bind:value={name}
          oninput={saveDraft}
          disabled={pending}
        />
        <div class="payment-note">
          Please deposit your exact payment at the Payment Station. Need change or assistance? Ring
          the bell!
        </div>
        {#if quoteData?.pending}<div class="notice">
            Your total includes priced items only. Custom requests are submitted for an employee’s
            price confirmation.
          </div>{/if}<button
          class="primary wide"
          disabled={busy || !settings.open || name.trim().length < 2 || (!pending && stale)}
          onclick={submit}
          >{busy ? 'Sending your order…' : pending ? 'Retry sending order' : 'Place order'}
          <Icon name="arrow" /></button
        ><button class="text-button" disabled={busy} onclick={() => (step = 2)}
          >← Review basket</button
        >
      </div>{/if}
  </section>
  <aside class="basket panel">
    <div class="basket-title">
      <h2>Your basket</h2>
      <span>{count}</span>
    </div>
    {#if !cart.length}<div class="empty-basket">
        <Icon name="bag" size={44} />
        <h3>A little empty. For now.</h3>
        <p>Pick a favorite and let’s fix that.</p>
      </div>{:else}{#each cart as line, i}{@const item = menu.find((m) => m.id === line.id)}
        <div class="basket-line">
          <div>
            <strong>{item?.name ?? 'Unavailable item'}</strong
            >{#if !item || item.available === false}<small class="error"
                >No longer available — remove from basket.</small
              >{/if}<small>{line.option}{line.note ? ' · ' + line.note : ''}</small><small
              >{item?.price == null
                ? 'Employee confirms price'
                : money(item.price) + ' each'}</small
            >
          </div>
          <strong>{item?.price == null ? 'Pending' : money(item.price * line.quantity)}</strong>
          <div class="quantity">
            <button
              disabled={pending}
              aria-label={'Decrease ' + item?.name}
              onclick={() => quantity(i, -1)}>−</button
            ><span>{line.quantity}</span><button
              disabled={pending || line.quantity >= 20}
              aria-label={'Increase ' + item?.name}
              onclick={() => quantity(i, 1)}>+</button
            >
          </div>
        </div>{/each}
      {@const price = step > 1 && quoteData ? quoteData : preview}{#if price}<div class="totals">
          <p><span>Subtotal</span><span>{money(price.subtotal)}</span></p>
          <p class="savings">
            <span>Verified discount · {price.promotion}</span><span>−{money(price.discount)}</span>
          </p>
          <p><span>Tax</span><span>$0.00</span></p>
          <p class="total">
            <span>{price.pending ? 'Known total' : 'Final amount due'}</span><strong
              >{money(price.total)}</strong
            >
          </p>
          <small>Applied coupon: {price.coupon ?? 'None'}</small>
          {#if price.pending}<small>+ custom items awaiting an employee’s price</small>{/if}
        </div>{:else}<p class="error">
          An item changed or is sold out. Remove it before continuing.
        </p>{/if}
      {#if step === 1}<button class="primary wide" disabled={!preview || busy} onclick={review}
          >Review order <Icon name="arrow" /></button
        >{/if}
      <p class="basket-footer">Made with care. Served with a smile. ♡</p>{/if}
  </aside>
</div>
{#if selected}<dialog
    class="modal"
    use:showDialog
    onclose={() => (selected = null)}
    aria-label={'Customize ' + selected.name}
  >
    <button class="modal-close" onclick={() => (selected = null)} aria-label="Close customization"
      >×</button
    >
    <p class="eyebrow">JUST THE WAY YOU LIKE IT</p>
    <h2>{selected.name}</h2>
    {#if selected.options}<label for="option">Your choice</label><select
        id="option"
        bind:value={option}
        >{#each selected.options as choice}<option>{choice}</option>{/each}</select
      >{/if}<label for="request"
      >{selected.category === 'Custom' ? 'Describe your request' : 'Notes (optional)'}</label
    ><textarea
      id="request"
      bind:value={note}
      maxlength="300"
      placeholder="Tell us what sounds good…"></textarea>{#if selected.price === null}<p>
        Availability and price will be confirmed by an employee.
      </p>{/if}<button
      class="primary wide"
      disabled={selected.category === 'Custom' && !note.trim()}
      onclick={() => selected && addLine(selected, note.trim(), option)}>Add to basket</button
    >
  </dialog>{/if}
