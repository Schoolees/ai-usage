import { createRoot } from 'react-dom/client';
import { followSystemTheme } from '../theme';
import { SettingsApp } from './SettingsApp';
import './settings.css';

followSystemTheme(window.api);

createRoot(document.getElementById('root')!).render(<SettingsApp />);
