<script lang="ts">
  import { api } from '$lib/api';
  import { money } from '$lib/pricing';
  import { defaultSeasonal, decorationControls, seasonalSettings } from '$lib/seasonal';
  import type { MenuItem, Offer, Settings } from '$lib/types';
  export let settings: Settings;
  export let menu: MenuItem[];
  export let save: (body: unknown) => Promise<boolean>;
  let error = '';
  let savingTheme = false;
  async function setTheme(key: keyof typeof defaultSeasonal, value: boolean) {
    savingTheme = true;
    try {
      await save({ seasonal: { [key]: value } });
    } finally {
      savingTheme = false;
    }
  }
  let preview = false;
  let offer: Offer & { code?: string } = blank();
  let redemptions: { order: string; offer: string; discount: number; createdAt: number }[] = [];
  let customer = '';
  let approval = '';
  function blank(): Offer {
    return {
      id: '',
      name: '',
      enabled: false,
      kind: 'sip',
      eligibility: 'coupon',
      starts: '',
      expires: '',
      minimum: 0,
      requiredItem: '',
      quantity: 1,
      amount: 0,
      limit: 1,
    };
  }
  async function saveOffer() {
    error = '';
    const body = {
      ...offer,
      starts: offer.starts ? new Date(offer.starts).toISOString() : '',
      expires: offer.expires ? new Date(offer.expires).toISOString() : '',
    };
    if (await save({ offer: body })) offer = blank();
  }
  function localDate(value: string) {
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  async function review() {
    try {
      redemptions = await api('/promotion-redemptions');
    } catch {
      error = 'Could not load redemptions.';
    }
  }
  async function approve() {
    try {
      approval = (
        await api<{ token: string }>('/promotion-approval', { offerId: offer.id, customer })
      ).token;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not approve.';
    }
  }
</script>

<div class="panel seasonal-management">
  <h2>Seasonal Management Center</h2>
  {#each decorationControls as [key, label]}
    <label class="check-label"
      ><input
        type="checkbox"
        checked={seasonalSettings(settings.seasonal)[key]}
        disabled={savingTheme}
        onchange={(e) => setTheme(key, e.currentTarget.checked)}
      />
      {label}</label
    >
  {/each}
  <button class="secondary" onclick={() => (preview = !preview)}>Preview seasonal theme</button>
  {#if preview}<div class="festive-banner">
      <p>🍂 🦃 🎃 🍹</p>
      <strong>🎉 GRAND OPENING — NOVEMBER 26, 2026</strong>
      <p>Happy Thanksgiving from Caleb’s Bar + Bites!</p>
      <small>Preview only — use the controls above to save.</small>
    </div>{/if}
  <h3>Promotion eligibility</h3>
  <p>
    Offers are unavailable until configured here. One offer per order, one redemption per customer
    session, plus the global redemption limit. Membership verification is not configured;
    member-only offers stay unavailable.
  </p>
  <p>
    Existing bundle recipes require main-menu categories: Sip &amp; Share needs a bite and mocktail;
    BOGO needs two mocktails; Ultimate needs two bites, two mocktails and a dessert. Their original
    repeated-group calculations remain in place. Set the actual program requirements before
    enabling.
  </p>
  {#each settings.offers ?? [] as saved}<button
      class="secondary"
      onclick={() => {
        offer = { ...saved, starts: localDate(saved.starts), expires: localDate(saved.expires) };
        approval = '';
      }}>{saved.name} · {saved.enabled ? 'Enabled' : 'Disabled'}</button
    >{/each}
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void saveOffer();
    }}
  >
    <label for="offer-id">Offer ID (keep unchanged when editing)</label><input
      id="offer-id"
      bind:value={offer.id}
      pattern={'[a-z0-9-]{1,60}'}
      required
    />
    <label for="offer-name">Offer name</label><input
      id="offer-name"
      bind:value={offer.name}
      maxlength="80"
      required
    />
    <label for="offer-kind">Discount recipe</label><select id="offer-kind" bind:value={offer.kind}>
      <option value="sip">Sip &amp; Share</option><option value="bogo">BOGO Mocktails</option
      ><option value="ultimate">Ultimate bundle</option><option value="fixed"
        >Fixed discount / credit</option
      ><option value="percent">Percentage discount</option><option value="free"
        >Free qualifying item(s)</option
      >
    </select>
    <label for="offer-eligibility">Eligibility requirement</label><select
      id="offer-eligibility"
      bind:value={offer.eligibility}
      ><option value="cart">Qualifying cart only</option><option value="coupon"
        >Valid coupon and qualifying cart</option
      ><option value="manager">Manager approval and qualifying cart</option><option value="member"
        >Verified member (unavailable)</option
      ></select
    >
    <label for="offer-code">Set coupon code (leave empty to retain existing)</label><input
      id="offer-code"
      type="password"
      autocomplete="new-password"
      bind:value={offer.code}
      minlength="4"
      maxlength="100"
    />
    <label for="offer-start">Starts (this device’s local time)</label><input
      id="offer-start"
      type="datetime-local"
      bind:value={offer.starts}
      required
    />
    <label for="offer-end">Expires (this device’s local time)</label><input
      id="offer-end"
      type="datetime-local"
      bind:value={offer.expires}
      required
    />
    <label for="offer-minimum">Minimum subtotal (cents)</label><input
      id="offer-minimum"
      type="number"
      min="0"
      max="100000"
      step="1"
      bind:value={offer.minimum}
      required
    />
    <label for="offer-item">Required item (also free item for a free-item recipe)</label><select
      id="offer-item"
      bind:value={offer.requiredItem}
      ><option value="">Bundle recipe requirements only</option
      >{#each menu.filter((i) => i.price !== null) as item}<option value={item.id}
          >{item.name}</option
        >{/each}</select
    >
    <label for="offer-quantity">Required / free quantity</label><input
      id="offer-quantity"
      type="number"
      min="1"
      max="20"
      step="1"
      bind:value={offer.quantity}
      required
    />
    <label for="offer-amount">Discount amount (cents, or whole percent for percentage)</label><input
      id="offer-amount"
      type="number"
      min="0"
      max="100000"
      step="1"
      bind:value={offer.amount}
      required
    />
    <label for="offer-limit">Global redemption limit</label><input
      id="offer-limit"
      type="number"
      min="1"
      max="100000"
      step="1"
      bind:value={offer.limit}
      required
    />
    <label class="check-label"
      ><input type="checkbox" bind:checked={offer.enabled} /> Enable this promotion</label
    >
    <button class="primary">Save promotion</button><button
      class="secondary"
      type="button"
      onclick={() => (offer = blank())}>New promotion</button
    >
  </form>
  {#if offer.eligibility === 'manager' && offer.id}<h3>Approve this customer</h3>
    <label for="approval-customer">Customer approval request ID</label><input
      id="approval-customer"
      bind:value={customer}
    /><button class="secondary" onclick={approve}>Generate one-use approval</button>{#if approval}<p
      >
        Give this token to the customer. Valid 10 minutes, for this customer and offer only.
      </p>
      <code>{approval}</code>{/if}{/if}
  <button class="secondary" onclick={review}>Review promotion redemptions</button>
  {#each redemptions as row}<p>
      {row.order} · {row.offer} · {money(row.discount)} · {new Date(row.createdAt).toLocaleString()}
    </p>{/each}
  {#if !redemptions.length}<p>No redemptions loaded.</p>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</div>
