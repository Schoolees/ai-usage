import { createRoot } from 'react-dom/client';
import { followSystemTheme } from '../theme';
import { IslandApp } from './IslandApp';
import './island.css';

followSystemTheme(window.api);

createRoot(document.getElementById('root')!).render(<IslandApp />);
