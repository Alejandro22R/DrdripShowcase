import type { ComponentChildren, JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import Swal from 'sweetalert2';
import { ApiError, upload } from './api';

// --- Alerts (SweetAlert2 with the brand colours) -----------------------------

const swal = Swal.mixin({
  confirmButtonColor: '#687568',
  cancelButtonColor: '#929985',
  cancelButtonText: 'Cancelar',
  confirmButtonText: 'Aceptar',
  reverseButtons: true,
  customClass: { popup: 'swal-brand' },
});

export function toast(title: string, icon: 'success' | 'error' | 'info' | 'warning' = 'success'): void {
  void swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: icon === 'error' ? 5000 : 2200, timerProgressBar: false });
}

export function showError(err: unknown): void {
  const message = err instanceof ApiError || err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
  void swal.fire({ icon: 'error', title: 'No se pudo completar', text: message });
}

export async function confirm(title: string, text: string, confirmText = 'Sí, continuar', danger = false): Promise<boolean> {
  const result = await swal.fire({
    icon: danger ? 'warning' : 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    confirmButtonColor: danger ? '#9b4a3c' : '#687568',
    focusCancel: danger,
  });
  return result.isConfirmed;
}

export async function prompt(title: string, label: string, value = '', placeholder = ''): Promise<string | null> {
  const result = await swal.fire({
    title,
    input: 'text',
    inputLabel: label,
    inputValue: value,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
  });
  return result.isConfirmed ? String(result.value ?? '').trim() : null;
}

export function info(title: string, html: string): void {
  void swal.fire({ icon: 'info', title, html });
}

/** Runs an action and shows the error, if any. Returns true on success. */
export async function run(action: () => Promise<unknown>, success?: string): Promise<boolean> {
  try {
    await action();
    if (success) toast(success);
    return true;
  } catch (err) {
    showError(err);
    return false;
  }
}

// --- Data loading -----------------------------------------------------------------

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = [], pollMs = 0): { data: T | null; reload: () => Promise<void>; error: string } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const ref = useRef(loader);
  ref.current = loader;
  const reload = useCallback(async () => {
    try {
      setData(await ref.current());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, []);
  useEffect(() => {
    void reload();
    if (!pollMs) return;
    const timer = setInterval(() => void reload(), pollMs);
    return () => clearInterval(timer);
  }, deps);
  return { data, reload, error };
}

// --- Building blocks ---------------------------------------------------------------

export function Page(props: { title: string; subtitle?: string; actions?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="page">
      <header class="page-head">
        <div>
          <h1>{props.title}</h1>
          {props.subtitle && <p class="muted">{props.subtitle}</p>}
        </div>
        <div class="actions">{props.actions}</div>
      </header>
      {props.children}
    </div>
  );
}

export function Loading(props: { error?: string }) {
  return <p class="muted pad">{props.error || 'Cargando…'}</p>;
}

export function Field(props: { label: string; hint?: string; error?: string; children: ComponentChildren; wide?: boolean }) {
  return (
    <label class={`field${props.wide ? ' wide' : ''}${props.error ? ' has-error' : ''}`}>
      <span class="field-label">{props.label}</span>
      {props.children}
      {props.error ? <span class="field-error">{props.error}</span> : props.hint ? <span class="field-hint">{props.hint}</span> : null}
    </label>
  );
}

export function Toggle(props: { checked: boolean; onChange: (value: boolean) => void; label?: string; title?: string }) {
  return (
    <label class="toggle" title={props.title}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)} />
      <span class="toggle-track" />
      {props.label && <span class="toggle-label">{props.label}</span>}
    </label>
  );
}

export function Modal(props: { title: string; onClose: () => void; children: ComponentChildren; footer?: ComponentChildren; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);
  return (
    <div class="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class={`modal${props.wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <header class="modal-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" onClick={props.onClose} aria-label="Cerrar">✕</button>
        </header>
        <div class="modal-body">{props.children}</div>
        {props.footer && <footer class="modal-foot">{props.footer}</footer>}
      </div>
    </div>
  );
}

export function ImagePicker(props: { value: string; onChange: (url: string) => void; accept?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    setBusy(true);
    try {
      props.onChange(await upload(file));
    } catch (err) {
      showError(err);
    }
    setBusy(false);
  };
  const isVideo = /\.(mp4|webm)$/.test(props.value);
  return (
    <div class="image-picker">
      {props.value ? (
        isVideo ? <video src={props.value} muted class="thumb" /> : <img src={props.value} alt="" class="thumb" />
      ) : (
        <div class="thumb empty">Sin archivo</div>
      )}
      <div class="image-picker-actions">
        <label class="btn small">
          {busy ? 'Subiendo…' : props.label ?? 'Elegir archivo'}
          <input type="file" accept={props.accept ?? 'image/jpeg,image/png,image/webp'} onChange={pick} hidden disabled={busy} />
        </label>
        {props.value && <button class="btn small ghost" onClick={() => props.onChange('')}>Quitar</button>}
      </div>
    </div>
  );
}

/** Textarea that edits a list of strings, one per line. */
export function LinesInput(props: { value: string[]; onChange: (value: string[]) => void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(props.value.join('\n'));
  const last = useRef(props.value);
  if (last.current !== props.value && props.value.join('\n') !== text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n')) {
    setText(props.value.join('\n'));
  }
  last.current = props.value;
  return (
    <textarea
      rows={props.rows ?? 4}
      value={text}
      placeholder={props.placeholder}
      onInput={(e) => {
        const next = e.currentTarget.value;
        setText(next);
        props.onChange(next.split('\n').map((l) => l.trim()).filter(Boolean));
      }}
    />
  );
}

export function formatDate(iso: string): string {
  const date = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico', dateStyle: 'medium', timeStyle: 'short' });
}

export function formatBytes(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Warns before leaving the page while a form has unsaved changes. */
export function useUnsavedWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
