<script lang="ts">
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
  Original artwork goes here. These readable placeholder menus are ready to be replaced.
</div>
<div class="menu-stage">
  <div
    class="menu-flipper"
    class:flipped={back}
    class:kids
    aria-label={kids ? 'Kids menu' : back ? 'Main menu back' : 'Main menu front'}
  >
    <div class="menu-face front" aria-hidden={back}>
      <img
        src={kids ? '/menus/kids-menu.png' : '/menus/main-menu-front.png'}
        alt={kids ? 'Caleb’s kids menu' : 'Caleb’s main menu front'}
        onerror={() => (failed = true)}
      />
    </div>
    {#if !kids}<div class="menu-face back" aria-hidden={!back}>
        <img
          src="/menus/main-menu-back.png"
          alt="Caleb’s main menu back"
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
