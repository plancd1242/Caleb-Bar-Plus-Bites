<script lang="ts">
  export let name = 'home';
  export let size = 22;
  const paths: Record<string, string> = {
    home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    bag: 'M5 7h14l1 14H4L5 7Zm3 0V6a4 4 0 0 1 8 0v1',
    book: 'M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2Z',
    kids: 'M8 14c0-4 8-4 8 0 0 3 4 5 1 6-2 1-3-1-5-1s-3 2-5 1c-3-1 1-3 1-6ZM5 7v2m5-6v3m5-3v3m5 1v2',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v6l4 2',
    lock: 'M6 10h12v11H6Zm2 0V6a4 4 0 0 1 8 0v4m-4 5v2',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    leaf: 'M5 19C-1 9 11 3 21 3c0 10-5 21-16 16Zm0 0L16 8',
    wifi: 'M3 8c5-5 13-5 18 0M6 12c3-3 9-3 12 0m-8 4a3 3 0 0 1 4 0m-2 4h.01',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    star: 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] ?? paths.star} /></svg
>
