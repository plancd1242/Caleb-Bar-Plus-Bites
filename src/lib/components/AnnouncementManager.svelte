<script lang="ts">
  import type { Announcement, AnnouncementSettings, Settings } from '$lib/types';
  import { defaultAnnouncements, validateAnnouncements } from '$lib/announcements';
  import Announcements from './Announcements.svelte';
  export let settings: Settings;
  export let save: (body: unknown) => Promise<boolean>;
  let draft: AnnouncementSettings = structuredClone(settings.announcements ?? defaultAnnouncements);
  let revision = settings.revision;
  let editor: Announcement | null = null;
  let removing: string | null = null;
  let preview = false;
  let busy = false;
  let error = '';
  let message = '';
  const localDate = (value: string) => {
    if (!value) return '';
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  function edit(item?: Announcement) {
    editor = item
      ? { ...item, starts: localDate(item.starts), expires: localDate(item.expires) }
      : {
          id: crypto.randomUUID(),
          text: '',
          icon: '',
          image: '',
          enabled: false,
          seasonal: false,
          starts: '',
          expires: '',
        };
    error = '';
    message = '';
  }
  function keep() {
    if (!editor) return;
    try {
      const item = {
        ...editor,
        starts: editor.starts ? new Date(editor.starts).toISOString() : '',
        expires: editor.expires ? new Date(editor.expires).toISOString() : '',
      };
      validateAnnouncements({ mode: draft.mode, items: [item] });
      const exists = draft.items.some((a) => a.id === item.id);
      draft = {
        ...draft,
        items: exists
          ? draft.items.map((a) => (a.id === item.id ? item : a))
          : [...draft.items, item],
      };
      editor = null;
      message = 'Draft updated. Preview and Publish announcements to make changes live.';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid announcement.';
    }
  }
  function move(index: number, delta: number) {
    const items = [...draft.items];
    [items[index], items[index + delta]] = [items[index + delta], items[index]];
    draft = { ...draft, items };
  }
  async function publish() {
    busy = true;
    error = '';
    message = '';
    try {
      validateAnnouncements(draft);
      if (await save({ announcements: draft, revision })) {
        revision = settings.revision;
        message = 'Announcements published to all stations.';
      }
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }
  function reload() {
    draft = structuredClone(settings.announcements ?? defaultAnnouncements);
    revision = settings.revision;
    editor = null;
    error = '';
    message = 'Loaded current announcements.';
  }
</script>

<section class="panel announcement-manager">
  <h2>Announcement Manager</h2>
  <p>
    Edit your draft, preview it, then publish to every connected station. Empty dates mean no time
    limit. Disabled or expired announcements are hidden.
  </p>
  {#if error}<p class="notice error" role="alert">{error}</p>{/if}{#if message}<p role="status">
      {message}
    </p>{/if}
  <label for="announcement-mode">Announcement display mode</label><select
    id="announcement-mode"
    bind:value={draft.mode}
    ><option value="rotating">Rotating announcements</option><option value="single"
      >Single announcement (first eligible)</option
    ><option value="decorations">Seasonal decorations</option></select
  >
  <button class="primary" onclick={() => edit()}>Create announcement</button>
  {#each draft.items as item, index}<div class="manager-row">
      <div>
        <strong>{item.icon} {item.text}</strong><small
          >{item.enabled ? 'Enabled' : 'Disabled'}{item.seasonal ? ' · Seasonal' : ''}</small
        >
      </div>
      <button class="secondary" onclick={() => edit(item)}>Edit announcement</button>
      <button
        class="secondary"
        onclick={() => {
          draft = {
            ...draft,
            items: draft.items.map((a) => (a.id === item.id ? { ...a, enabled: !a.enabled } : a)),
          };
        }}>{item.enabled ? 'Disable' : 'Enable'}</button
      >
      <button
        class="text-button"
        aria-label={'Move up ' + item.text}
        disabled={index === 0}
        onclick={() => move(index, -1)}>↑</button
      ><button
        class="text-button"
        aria-label={'Move down ' + item.text}
        disabled={index === draft.items.length - 1}
        onclick={() => move(index, 1)}>↓</button
      >
      <button class="text-button" onclick={() => (removing = item.id)}>Delete announcement</button>
    </div>{/each}
  {#if removing}<div class="notice" role="alert">
      <p>
        Delete this announcement from the draft? Publish afterward to remove it from customers’
        screens.
      </p>
      <button class="secondary" onclick={() => (removing = null)}>Cancel deletion</button><button
        class="secondary"
        onclick={() => {
          draft = { ...draft, items: draft.items.filter((a) => a.id !== removing) };
          removing = null;
        }}>Confirm deletion</button
      >
    </div>{/if}
  {#if editor}<form
      class="announcement-editor"
      onsubmit={(e) => {
        e.preventDefault();
        keep();
      }}
    >
      <h3>
        {draft.items.some((a) => a.id === editor?.id) ? 'Edit announcement' : 'New announcement'}
      </h3>
      <label for="announcement-text">Announcement text</label><textarea
        id="announcement-text"
        bind:value={editor.text}
        maxlength="240"
        required></textarea>
      <label for="announcement-icon">Optional icon</label><input
        id="announcement-icon"
        bind:value={editor.icon}
        maxlength="16"
      />
      <label for="announcement-image">Optional image URL (HTTPS or /art/ asset)</label><input
        id="announcement-image"
        bind:value={editor.image}
        maxlength="1000"
      />
      <label for="announcement-start">Announcement start (local time)</label><input
        id="announcement-start"
        type="datetime-local"
        bind:value={editor.starts}
      />
      <label for="announcement-end">Announcement expiration (local time)</label><input
        id="announcement-end"
        type="datetime-local"
        bind:value={editor.expires}
      />
      <label class="check-label"
        ><input type="checkbox" bind:checked={editor.enabled} /> Enabled announcement</label
      ><label class="check-label"
        ><input type="checkbox" bind:checked={editor.seasonal} /> Seasonal announcement</label
      >
      <button class="primary">Save announcement draft</button><button
        type="button"
        class="secondary"
        onclick={() => (editor = null)}>Cancel edit</button
      >
    </form>{/if}
  <div class="announcement-actions">
    <button class="secondary" onclick={() => (preview = !preview)}>Preview announcements</button
    ><button class="primary" disabled={busy || !!editor} onclick={publish}
      >Publish announcements</button
    ><button class="text-button" disabled={busy} onclick={reload}
      >Reload published announcements</button
    >
  </div>
  {#if preview}<Announcements {settings} config={draft} preview />{/if}
</section>
