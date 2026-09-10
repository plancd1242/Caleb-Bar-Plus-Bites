<script lang="ts">
  import { onMount } from 'svelte';
  import type { CartLine, MenuItem, Order, Promotion, Quote, Settings } from '$lib/types';
  import { quote, money } from '$lib/pricing';
  import { api } from '$lib/api';
  import Icon from './Icon.svelte';
  export let menu: MenuItem[];
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
  let promotion: Promotion = 'best';
  let error = '';
  let busy = false;
  let quoteData: Quote | null = null;
  let selected: MenuItem | null = null;
  let note = '';
  let option = '';
  let requestId = '';
  let pending = false;
  const categories = ['All', 'Bites', 'Mocktails', 'Desserts', 'Drinks', 'Specials', 'Custom'];
  $: visible = menu.filter(
    (i) => Boolean(i.kids) === kids && (category === 'All' || i.category === category),
  );
  $: preview = (() => {
    try {
      return quote(cart, menu, settings.promotions ? promotion : 'none', settings.revision);
    } catch {
      return null;
    }
  })();
  $: count = cart.reduce((s, l) => s + l.quantity, 0);
  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('barn-checkout') ?? 'null');
      if (saved) {
        name = typeof saved.name === 'string' ? saved.name.slice(0, 60) : '';
        promotion = ['best', 'none', 'sip', 'bogo', 'ultimate'].includes(saved.promotion)
          ? saved.promotion
          : 'best';
        requestId =
          typeof saved.requestId === 'string' && /^[a-f0-9-]{36}$/.test(saved.requestId)
            ? saved.requestId
            : '';
        pending = !!requestId;
      }
    } catch {
      /* A damaged draft never blocks ordering. */
    }
  });
  function change(lines: CartLine[]) {
    if (pending) return;
    error = '';
    quoteData = null;
    onCart(lines);
  }
  function add(item: MenuItem) {
    if (pending) return;
    if (item.options || item.category === 'Custom') {
      selected = item;
      note = '';
      option = item.options?.[0] ?? '';
    } else addLine(item, '', '');
  }
  function addLine(item: MenuItem, note: string, option: string) {
    const index = cart.findIndex((l) => l.id === item.id && l.note === note && l.option === option);
    if (index >= 0) {
      quantity(index, 1);
    } else change([...cart, { id: item.id, quantity: 1, note, option }]);
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
    try {
      quoteData = await api<Quote>('/quote', { cart, promotion });
      step = 2;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Couldn’t check your basket. Your items are saved.';
    }
  }
  function saveDraft() {
    try {
      localStorage.setItem('barn-checkout', JSON.stringify({ name, promotion, requestId }));
    } catch {
      error = 'Device storage is unavailable. Keep this page open until your order is confirmed.';
    }
  }
  async function submit() {
    if (busy) return;
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
        promotion,
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
        {#each categories.filter((c) => !kids || !['Desserts', 'Specials'].includes(c)) as c}<button
            class:active={category === c}
            onclick={() => (category = c)}>{c}</button
          >{/each}
      </div>
      <div class="item-grid">
        {#each visible as item}<article class="item-card" class:soldout={item.available === false}>
            <div class="food-art" class:berry={item.category === 'Mocktails'}>
              <span>{item.emoji}</span><small
                >{item.kids ? 'LITTLE FAVORITES' : item.category.toUpperCase()}</small
              >
            </div>
            <div class="item-body">
              <h3>{item.name}</h3>
              <p>{item.description || 'A classic, refreshing choice.'}</p>
              <div class="item-bottom">
                <strong>{item.price === null ? 'Price to confirm' : money(item.price)}</strong
                ><button
                  class="add-button"
                  aria-label={'Add ' + item.name}
                  disabled={item.available === false || pending}
                  onclick={() => add(item)}>{item.available === false ? 'Sold out' : '+'}</button
                >
              </div>
            </div>
          </article>{/each}
      </div>
    {:else if step === 2}<div class="panel">
        <p class="eyebrow">ONE MORE LOOK</p>
        <h2>Your happy little lineup.</h2>
        <p>Check your items on the right. Any custom prices will be confirmed by an employee.</p>
        <label for="promotion">Pick your special</label><select
          id="promotion"
          bind:value={promotion}
          disabled={pending || !settings.promotions}
          onchange={review}
          ><option value="best">Best single promotion — automatic</option><option value="none"
            >No promotion</option
          ><option value="sip">Sip & Share — save $3.50 per pair</option><option value="bogo"
            >BOGO Mocktails — lesser price free</option
          ><option value="ultimate">The Ultimate $10 Deal</option></select
        >
        <p class="fine-print">
          Main-menu bites, mocktails, and desserts qualify. Kids items and custom requests are
          excluded. One promotion type per order; complete groups may repeat. We automatically
          choose the biggest saving.
        </p>
        <button class="primary wide" onclick={() => (step = 3)}
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
          ♡ Pay your waiter after sending your order. No online payment needed.
        </div>
        {#if quoteData?.pending}<div class="notice">
            Your total includes priced items only. Custom requests are submitted for an employee’s
            price confirmation.
          </div>{/if}<button
          class="primary wide"
          disabled={busy || !settings.open || name.trim().length < 2}
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
            <strong>{item?.name ?? 'Unavailable item'}</strong><small
              >{line.option}{line.note ? ' · ' + line.note : ''}</small
            ><small
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
      {@const price = step > 1 ? quoteData : preview}{#if price}<div class="totals">
          <p><span>Subtotal</span><span>{money(price.subtotal)}</span></p>
          {#if price.discount}<p class="savings">
              <span>{price.promotion}</span><span>−{money(price.discount)}</span>
            </p>{/if}
          <p><span>Tax</span><span>$0.00</span></p>
          <p class="total">
            <span>{price.pending ? 'Known total' : 'Total'}</span><strong
              >{money(price.total)}</strong
            >
          </p>
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
