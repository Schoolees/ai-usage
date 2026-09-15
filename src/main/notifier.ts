import { Notification } from 'electron';

// Keep references until the toast is dismissed; otherwise Electron may garbage-collect it and drop the click handler.
const live = new Set<Notification>();

export function showAlert(text: { title: string; body: string }, onClick: () => void): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title: text.title, body: text.body, silent: false });
  live.add(notification);
  notification.on('click', () => {
    onClick();
    live.delete(notification);
  });
  notification.on('close', () => live.delete(notification));
  notification.show();
}
