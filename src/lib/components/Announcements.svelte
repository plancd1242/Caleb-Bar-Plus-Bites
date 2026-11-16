<script lang="ts">
  import { onMount } from 'svelte';
  import { activeAnnouncements, defaultAnnouncements } from '$lib/announcements';
  import { seasonalSettings } from '$lib/seasonal';
  import type { Settings, AnnouncementSettings } from '$lib/types';
  export let settings: Settings;
  export let now = new Date();
  export let explore: () => void = () => {};
  export let config: AnnouncementSettings | undefined = undefined;
  export let preview = false;
  let index = 0;
  let paused = false;
  let reduced = false;
  $: theme = seasonalSettings(settings.seasonal);
  $: source = config ?? settings.announcements ?? defaultAnnouncements;
  $: active = activeAnnouncements(source, now.getTime(), theme.seasonalAnnouncements);
  $: current = active[source.mode === 'single' ? 0 : index % Math.max(1, active.length)];
  onMount(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reduced = media.matches;
    };
    update();
    media.addEventListener('change', update);
    const timer = setInterval(() => {
      if (source.mode === 'rotating' && !paused && !reduced && !document.hidden) index++;
    }, 8000);
    return () => {
      clearInterval(timer);
      media.removeEventListener('change', update);
    };
  });
</script>

<section
  class="announcement-panel"
  aria-label={preview ? 'Announcement preview' : 'Restaurant Announcements'}
>
  <div class="announcement-copy">
    <p class="eyebrow">RESTAURANT ANNOUNCEMENTS</p>
    {#if source.mode === 'decorations'}<h2>Good food. Warm welcomes.</h2>
      <p>Welcome to Life by the Farm!</p>
    {:else if current}{#key current.id + current.image}<div
          class="announcement-content"
          aria-live="off"
        >
          <h2><span aria-hidden="true">{current.icon}</span> {current.text}</h2>
          {#if current.image && !theme.lightweight}<img
              class="announcement-image"
              src={current.image}
              alt=""
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              onerror={(e) => {
                (e.currentTarget as HTMLImageElement).hidden = true;
              }}
            />{/if}
        </div>{/key}
    {:else}<p>Welcome to Caleb’s Bar + Bites!</p>{/if}
    {#if !preview}<button class="primary" onclick={explore}>Explore Specials →</button>{/if}
    {#if source.mode === 'rotating' && active.length > 1}<div class="announcement-controls">
        <button class="text-button" onclick={() => index++}>Next announcement</button><button
          class="text-button"
          onclick={() => (paused = !paused)}>{paused ? 'Resume rotation' : 'Pause rotation'}</button
        >
      </div>{/if}
    {#if preview}<small>Preview only — save to publish.</small>{/if}
  </div>
  {#if theme.thanksgiving && theme.turkey}<img
      class="announcement-turkey"
      src={theme.lightweight ? '/art/turkey-lite.svg' : '/art/turkey.webp'}
      alt="Thanksgiving turkey beside pumpkins and autumn leaves"
      width="200"
      height="260"
      loading="lazy"
      decoding="async"
    />{/if}
</section>
