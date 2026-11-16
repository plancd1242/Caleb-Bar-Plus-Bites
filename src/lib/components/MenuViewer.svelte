<script lang="ts">
  import type { MenuItem } from '$lib/types';
  import { money } from '$lib/pricing';
  export let menu: MenuItem[];
  export let onSpecial: (item: MenuItem) => void;
  $: specials = menu.filter(
    (item) =>
      item.available !== false &&
      item.visibility !== 'order' &&
      Boolean(item.kids) === kids &&
      (item.special ||
        item.category === 'Specials' ||
        item.visibility === 'menu' ||
        item.visibility === 'both'),
  );
  export let kids = false;
  export let onOrder: () => void;
  let back = false;
  let flipping = false;
  let failed = false;
  function flip() {
    if (flipping) return;
    flipping = true;
    back = !back;
    setTimeout(() => (flipping = false), 700);
  }
</script>

<div class="page-heading">
  <div>
    <p class="eyebrow">{kids ? 'LITTLE BITES. BIG ADVENTURES.' : 'TAKE A LOOK AROUND'}</p>
    <h1>{kids ? 'A little menu. A lot of fun.' : 'Good things on every page.'}</h1>
    <p>
      {kids
        ? 'A little something for our littlest guests. 🐾'
        : 'Explore our bites, sips, and sweet treats. Flip it over for CJ’s favorites.'}
    </p>
  </div>
  <button class="primary" onclick={onOrder}>Let’s order <span>→</span></button>
</div>
<div class="menu-note">
  Illustrated favorites below. Current prices and availability are shown in Place Your Order.
</div>
{#if specials.length}<section aria-label="Specials">
    <h2>Specials</h2>
    <p>Fresh additions to the live menu.</p>
    <div class="item-grid">
      {#each specials as item}<article class="item-card">
          <div class="item-body">
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <div class="item-bottom">
              <strong>{item.price === null ? 'Price to confirm' : money(item.price)}</strong>
              {#if item.visibility !== 'menu'}<button
                  class="secondary"
                  onclick={() => onSpecial(item)}>Order {item.name}</button
                >{:else}<small>Ask staff about this item.</small>{/if}
            </div>
          </div>
        </article>{/each}
    </div>
  </section>{/if}
<div class="menu-stage">
  <div
    class="menu-flipper"
    class:flipped={back}
    class:kids
    aria-label={kids ? 'Kids menu' : back ? 'Main menu back' : 'Main menu front'}
  >
    <div class="menu-face front" aria-hidden={back}>
      <img
        src={kids
          ? '/menus/kids-menu-thanksgiving-2026.png'
          : '/menus/main-menu-front-thanksgiving-2026.png'}
        alt={kids
          ? 'Caleb’s Thanksgiving 2026 kids menu'
          : 'Caleb’s Thanksgiving 2026 main menu front'}
        onerror={() => (failed = true)}
      />
    </div>
    {#if !kids}<div class="menu-face back" aria-hidden={!back}>
        <img
          src="/menus/main-menu-back-thanksgiving-2026.png"
          alt="Caleb’s Thanksgiving 2026 main menu back"
          onerror={() => (failed = true)}
        />
      </div>{/if}
  </div>
  {#if failed}<div class="notice">
      This menu image couldn’t load. All items and prices are still available in <button
        class="text-button"
        onclick={onOrder}>Place Your Order</button
      >.
    </div>{/if}
  {#if !kids}<div class="flip-wrap">
      <button class="flip-button" onclick={flip} disabled={flipping}
        >🌈 {back ? 'Flip to front' : 'Flip to back'} <span>↻</span></button
      >
    </div>{/if}
</div>
