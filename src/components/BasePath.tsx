import { createContext, useContext, type ReactNode } from 'react';

/**
 * Route prefix for project pages. IGNITE uses '' (/projects/…); MANAGERS use '/managers' (/managers/projects/…).
 * Both open the SAME project records through the same API — only the surrounding layout differs.
 */
const Ctx = createContext('');
export const BasePathProvider = ({ base, children }: { base: string; children: ReactNode }) => <Ctx.Provider value={base}>{children}</Ctx.Provider>;
export const useBase = () => useContext(Ctx);
