import { createContext, useContext, useState } from 'react';
import { type Client } from '@/lib/parseClients';

interface ClientsCtx {
  clients: Client[];
  isDemo: boolean;
  setClients: (c: Client[], demo: boolean) => void;
}

const Ctx = createContext<ClientsCtx | null>(null);

export const ClientsProvider = ({ children }: { children: React.ReactNode }) => {
  const [clients, setClientsState] = useState<Client[]>([]);
  const [isDemo, setIsDemo] = useState(true);

  const setClients = (c: Client[], demo: boolean) => {
    setClientsState(c);
    setIsDemo(demo);
  };

  return <Ctx.Provider value={{ clients, isDemo, setClients }}>{children}</Ctx.Provider>;
};

export const useClients = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useClients must be used within ClientsProvider');
  return ctx;
};
