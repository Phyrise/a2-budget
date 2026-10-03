/** Labo du monde — entrée (dev seulement, absent du build de production). */
import { createRoot } from 'react-dom/client';
import { LabApp } from './LabApp';

const el = document.getElementById('lab');
if (el) createRoot(el).render(<LabApp />);
