import { StartClient } from '@tanstack/react-start/client';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

const app = <StartClient />;

hydrateRoot(document, import.meta.env.DEV ? <StrictMode>{app}</StrictMode> : app);
