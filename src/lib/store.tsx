import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { type Bit, DEFAULT_MESSAGE } from '../core';

interface MessageState {
  message: Bit[];
  setMessage: (m: Bit[]) => void;
  toggleBit: (i: number) => void;
  resetMessage: () => void;
}

const Ctx = createContext<MessageState | null>(null);

/** The 4-bit message is shared by modules 1, 2, 3, 6 and 7 so the story stays continuous. */
export function MessageProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Bit[]>([...DEFAULT_MESSAGE]);
  const value = useMemo<MessageState>(
    () => ({
      message,
      setMessage,
      toggleBit: (i) => setMessage((m) => m.map((b, j) => (j === i ? ((1 - b) as Bit) : b))),
      resetMessage: () => setMessage([...DEFAULT_MESSAGE]),
    }),
    [message],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMessage(): MessageState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMessage must be used inside MessageProvider');
  return v;
}
